"""Small, single-purpose helpers for issuing JWTs and managing the refresh cookie.

The access token always travels in the JSON response body. The refresh token
never does - it only ever lives in an httpOnly cookie, set/read/cleared by the
functions below. Views should stay thin and just call these.
"""

from django.conf import settings
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken


def issue_tokens_for_user(user):
    """Create a fresh (refresh, access) token pair for a newly authenticated user."""
    refresh = RefreshToken.for_user(user)
    return str(refresh), str(refresh.access_token)


def rotate_refresh_token(raw_refresh_token):
    """Validate a refresh token and exchange it for a new access token.

    Delegates to SimpleJWT's own TokenRefreshSerializer so rotation and
    blacklisting behave exactly as configured in settings.SIMPLE_JWT. Raises
    rest_framework_simplejwt.exceptions.InvalidToken if the token is missing,
    expired, or blacklisted - callers don't need to check for that themselves.

    Returns (access, new_refresh_or_None). new_refresh is None when
    ROTATE_REFRESH_TOKENS is off.
    """
    serializer = TokenRefreshSerializer(data={"refresh": raw_refresh_token})
    try:
        serializer.is_valid(raise_exception=True)
    except TokenError as e:
        # TokenRefreshSerializer.validate() raises the bare TokenError from
        # RefreshToken.__init__ (e.g. "Token is blacklisted") uncaught - it
        # isn't a DRF APIException, so left alone it becomes a 500 instead of
        # a 401. Convert it the same way SimpleJWT's own TokenRefreshView does.
        raise InvalidToken(e.args[0]) from e
    return serializer.validated_data["access"], serializer.validated_data.get("refresh")


def blacklist_refresh_token(raw_refresh_token):
    """Invalidate a refresh token so it can no longer mint new access tokens."""
    try:
        RefreshToken(raw_refresh_token).blacklist()
    except TokenError:
        pass  # already invalid/expired - nothing left to invalidate


def set_refresh_cookie(response, refresh_token):
    """Attach the refresh token to the response as an httpOnly cookie."""
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path="/api/auth/",
    )
    return response


def clear_refresh_cookie(response):
    """Remove the refresh-token cookie, e.g. on logout."""
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path="/api/auth/",
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )
    return response


def get_refresh_token_from_request(request):
    """Read the refresh token out of the request's cookies, if present."""
    return request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
