"use client";

import { Building2, LayoutGrid, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { CategoriesTab } from "@/components/organization/CategoriesTab";
import { DepartmentsTab } from "@/components/organization/DepartmentsTab";
import { EmployeesTab } from "@/components/organization/EmployeesTab";

export default function OrganizationPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role !== "admin") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 py-20 text-center">
        <span className="bg-muted flex size-11 items-center justify-center rounded-xl">
          <Building2 className="text-ink-faint size-5" />
        </span>
        <h2 className="font-display text-ink text-lg font-semibold">Admins only</h2>
        <p className="text-ink-muted text-sm">
          Organization setup is restricted to administrators. Contact your admin if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h2 className="font-display text-ink text-2xl font-bold tracking-tight">Organization setup</h2>
        <p className="text-ink-muted mt-0.5 text-sm">
          Maintain the master data everything else depends on. This is the only place roles are assigned.
        </p>
      </div>

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">
            <Building2 />
            Departments
          </TabsTrigger>
          <TabsTrigger value="categories">
            <LayoutGrid />
            Categories
          </TabsTrigger>
          <TabsTrigger value="employees">
            <Users />
            Employees
          </TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4">
          <DepartmentsTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="employees" className="mt-4">
          <EmployeesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
