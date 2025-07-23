
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Key, Check, AlertCircle } from 'lucide-react';

const SlackTokenUpdater = () => {
  const [newToken, setNewToken] = useState('xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzEtOTA4MTEzMjM2MzY5Ny05MDgxMTMyNjMwNTc3LTkyMzg1NDQ5OTY4MzgtODJmY2M1NmIxMDhjMDlhMmNhOGQ5ZDRkNTliYjhhZWU0ZWY4MWQwMzVmNTVmZjY5Njc4MzliZmY5Yjg0NDVjYw');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdateToken = async () => {
    if (!newToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid token",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);

    try {
      // Log the token update to the database
      const { error: logError } = await supabase
        .from('slack_token_updates')
        .insert({
          old_token: 'Previous token (hidden for security)',
          new_token: newToken,
          refresh_date: new Date().toISOString(),
          status: 'manual_update'
        });

      if (logError) {
        console.error('Error logging token update:', logError);
      }

      toast({
        title: "⚠️ Token Update Required",
        description: "Please update the SLACK_BOT_TOKEN secret in your Supabase project settings with the new token.",
        variant: "default"
      });

      toast({
        title: "✅ Token Logged",
        description: "The new token has been logged. Please update it manually in Supabase secrets.",
        className: "bg-green-50 border-green-200"
      });

    } catch (error: any) {
      console.error('Error updating token:', error);
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to log token update",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Key className="w-5 h-5 mr-2" />
          Update Slack Bot Token
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-900">Manual Update Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                After clicking "Update Token", you'll need to manually update the SLACK_BOT_TOKEN secret in your 
                <a href="https://supabase.com/dashboard/project/ppuyedxxfcijdfeqpwfj/settings/functions" target="_blank" className="underline ml-1">
                  Supabase Functions Settings
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="token">New Slack Bot Token</Label>
          <Input
            id="token"
            type="text"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder="xoxe.xoxb-..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            The token should start with "xoxe.xoxb-" for the new format
          </p>
        </div>

        <Button 
          onClick={handleUpdateToken}
          disabled={isUpdating || !newToken.trim()}
          className="w-full"
        >
          {isUpdating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Updating...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Log Token Update
            </>
          )}
        </Button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Next Steps:</h4>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Click "Log Token Update" above</li>
            <li>Go to your Supabase project's function settings</li>
            <li>Update the SLACK_BOT_TOKEN secret with the new value</li>
            <li>The new token will be active immediately</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default SlackTokenUpdater;
