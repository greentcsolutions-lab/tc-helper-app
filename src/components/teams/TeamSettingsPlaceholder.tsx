"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Settings, UserPlus, Crown } from "lucide-react";
import Link from "next/link";

export function TeamSettingsPlaceholder() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Team Settings</h1>
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
            Coming Soon
          </span>
        </div>
        <p className="text-muted-foreground">
          Manage your team members, roles, and collaboration settings.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Add new team members by email
            </p>
            <Button disabled variant="outline" className="w-full">
              Send Invite
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manage Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              View and manage team member roles
            </p>
            <Button disabled variant="outline" className="w-full">
              View Members
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Team Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Manage your team subscription
            </p>
            <Button disabled variant="outline" className="w-full">
              Upgrade to Teams
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Team Management Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>
            What you&apos;ll be able to do with team settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Member Roles</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Crown className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Owner</span> - Full access including billing, member management, and all team features
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Users className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Member</span> - Can collaborate on transactions, create tasks, and access shared templates
                </div>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Team Limits</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Maximum 5 team members (1 owner + 4 members)</li>
              <li>• Owner is responsible for team billing</li>
              <li>• All members share team quotas and credits</li>
              <li>• Configurable based on your Teams plan tier</li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Collaboration Features</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Assign tasks to specific team members</li>
              <li>• Share task templates across the team</li>
              <li>• Centralized transaction management</li>
              <li>• Team-wide activity tracking</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Back Link */}
      <div className="flex justify-between items-center">
        <Link href="/teams">
          <Button variant="outline">
            ← Back to Teams
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="ghost">
            Go to Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
