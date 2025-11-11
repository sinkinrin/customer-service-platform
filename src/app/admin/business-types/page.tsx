'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Settings } from 'lucide-react'

export default function BusinessTypesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Types</h1>
          <p className="text-muted-foreground">
            Manage business types for conversation categorization
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Create Business Type (Coming Soon)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Type Management</CardTitle>
          <CardDescription>
            Configure business types to categorize customer conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground max-w-md">
              Business type management functionality is currently under development. 
              This feature will allow you to create and manage different business types 
              for better conversation categorization.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What are Business Types?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Purpose</h4>
            <p className="text-sm text-muted-foreground">
              Business types help categorize customer conversations based on the nature 
              of their inquiry (e.g., Sales, Support, Billing, Technical).
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Benefits</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Better conversation routing to specialized teams</li>
              <li>Improved analytics and reporting</li>
              <li>Enhanced customer experience through targeted support</li>
              <li>Streamlined workflow management</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Planned Features</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Create and edit business types</li>
              <li>Assign default staff teams to business types</li>
              <li>Set priority levels and SLA targets</li>
              <li>Configure automated routing rules</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

