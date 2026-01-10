"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Crown, UserPlus, Settings } from "lucide-react";
import Link from "next/link";

export default function TeamSettings() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Team Settings</h2>
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
            Coming Soon
          </span>
        </div>
        <p className="text-muted-foreground">
          Manage your team members and collaboration settings
        </p>
      </div>

      {/* Team Plan Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Teams Plan
          </CardTitle>
          <CardDescription>
            Collaborate with your team on transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Upgrade to the Teams plan to unlock collaboration features including task assignment,
              shared workflows, and communications center.
            </p>
            <div className="flex gap-3">
              <Link href="/teams">
                <Button variant="default">
                  Learn More
                </Button>
              </Link>
              <Button disabled variant="outline">
                Upgrade to Teams
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">What&apos;s Included</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Up to 6 team members (1 owner + 5 members)</li>
              <li>• Shared team quotas and AI credits</li>
              <li>• Task assignment to team members</li>
              <li>• Centralized workflow management</li>
              <li>• Team communications center</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Team Management Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Team Management
          </CardTitle>
          <CardDescription>
            Features available after upgrade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Member Roles</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Crown className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Owner</strong> - Full access including billing and member management
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Member</strong> - Can collaborate on transactions and tasks
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Actions</h4>
              <div className="space-y-2">
                <Button disabled variant="outline" className="w-full justify-start" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Team Members
                </Button>
                <Button disabled variant="outline" className="w-full justify-start" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Team Settings
                </Button>
                <Button disabled variant="outline" className="w-full justify-start" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  View Team Members
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Team features are currently in development. Once available, you&apos;ll be able to
              invite members, assign tasks, share templates, and manage your team from this page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
