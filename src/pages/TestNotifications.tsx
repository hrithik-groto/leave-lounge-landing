import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const TestNotifications = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runNotificationTests = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      toast.info('Running notification tests...');
      
      const { data, error } = await supabase.functions.invoke('test-slack-notifications');
      
      if (error) {
        throw error;
      }
      
      setResults(data);
      toast.success('Tests completed! Check the results below.');
    } catch (error) {
      console.error('Error running tests:', error);
      toast.error('Failed to run tests: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASSED':
        return 'bg-green-500';
      case 'FAILED':
        return 'bg-red-500';
      case 'ERROR':
        return 'bg-orange-500';
      case 'SKIPPED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Slack Notification Tests</h1>
        <p className="text-muted-foreground mt-2">
          Test all Slack notification functionality to ensure everything is working correctly.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Run Notification Tests</CardTitle>
          <CardDescription>
            This will test all notification scenarios:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Admin channel notifications for leave approvals</li>
              <li>All users channel notifications for approved leaves</li>
              <li>Personal DM notifications for leave status changes</li>
              <li>Mid-day notifications for recent leave applications</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runNotificationTests} 
            disabled={testing}
            className="w-full"
          >
            {testing ? 'Running Tests...' : 'Run All Notification Tests'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              {results.summary.passed} passed, {results.summary.failed} failed, {results.summary.errors} errors, {results.summary.skipped} skipped
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.summary.results.map((result: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium capitalize">
                      {result.test.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {result.message || result.error}
                    </p>
                  </div>
                  <Badge className={getStatusColor(result.status)}>
                    {result.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TestNotifications;