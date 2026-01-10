"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Workflow, MessageSquare, Sparkles } from "lucide-react";

export function TeamsPlaceholder() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Teams</h1>
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
            Coming Soon
          </span>
        </div>
        <p className="text-muted-foreground">
          Collaborate with your team on transactions and streamline your workflow.
        </p>
      </div>

      {/* Feature Preview Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Task Assignment */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle>Task Assignment</CardTitle>
            </div>
            <CardDescription>
              Assign tasks to specific team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Assign tasks to team members or external roles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Track who&apos;s responsible for each task</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Designate 3rd party roles (broker, escrow, etc.)</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Centralized Workflows */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              <CardTitle>Centralized Workflows</CardTitle>
            </div>
            <CardDescription>
              Shared access to files and tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Collaborate on up to 10 concurrent transactions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Shared team templates and workflows</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Real-time visibility into team progress</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Communications Center */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Communications Center</CardTitle>
            </div>
            <CardDescription>
              Keep everyone in the loop
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Team-wide notifications and updates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Comment threads on tasks and transactions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Activity feed for team transparency</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Team Structure Info */}
      <Card>
        <CardHeader>
          <CardTitle>Teams Plan</CardTitle>
          <CardDescription>
            Designed for real estate teams who need to collaborate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                What&apos;s Included
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Up to 5 team members (1 owner + 4 members)</li>
                <li>• 10 concurrent transactions</li>
                <li>• Shared AI parse credits</li>
                <li>• Team templates and workflows</li>
                <li>• Task assignment and tracking</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">How It Works</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Team leader manages billing</li>
                <li>• All members can collaborate on files</li>
                <li>• Read-only mode for now (no client access)</li>
                <li>• Assign tasks to team members or 3rd party roles</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button disabled className="w-full sm:w-auto">
              Join Waitlist
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Teams feature is currently in development. We&apos;ll notify you when it&apos;s ready!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
