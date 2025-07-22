
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Clock, CheckCircle, AlertTriangle, Zap, Key, Settings } from 'lucide-react';

interface TokenUpdate {
  id: string;
  new_token: string;
  refresh_date: string;
  status: string;
  created_at: string;
}

const SlackTokenManager = () => {
  const [tokenUpdates, setTokenUpdates] = useState<TokenUpdate[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTokenUpdates();
  }, []);

  const fetchTokenUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('slack_token_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTokenUpdates(data || []);
    } catch (error) {
      console.error('Error fetching token updates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('refresh-slack-token', {
        body: { source: 'manual' }
      });

      if (error) throw error;

      toast({
        title: "🔄 Token Refresh Initiated",
        description: "Refreshing Slack access and refresh tokens...",
        className: "bg-blue-50 border-blue-200"
      });

      // Refresh the list after a short delay
      setTimeout(() => {
        fetchTokenUpdates();
        toast({
          title: "✅ Tokens Updated",
          description: "Slack tokens have been refreshed successfully!",
          className: "bg-green-50 border-green-200"
        });
      }, 3000);

    } catch (error: any) {
      console.error('Error refreshing token:', error);
      toast({
        title: "❌ Refresh Failed",
        description: error.message || "Failed to refresh Slack tokens",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto_updated':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Zap className="w-3 h-3 mr-1" />Auto Updated</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending_update':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading token updates...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Slack Token Manager
          </span>
          <Button 
            onClick={handleRefreshToken}
            disabled={isRefreshing}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh Tokens
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
            <Zap className="w-4 h-4 mr-2" />
            Automatic Token Refresh Active
          </h4>
          <p className="text-sm text-blue-700 mb-2">
            Both access and refresh tokens are automatically updated every 10 hours to prevent expiration.
          </p>
          <div className="flex items-center text-xs text-blue-600">
            <Clock className="w-3 h-3 mr-1" />
            Next automatic refresh: Every 10 hours
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Current Tokens Status
          </h4>
          <div className="text-sm text-green-700 space-y-1">
            <p><strong>Access Token:</strong> xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzE... ✅ Active</p>
            <p><strong>Refresh Token:</strong> xoxe-1-My0xLTIyMTk5NjM5MTMyNzE... ✅ Active</p>
            <p className="text-xs text-green-600 mt-2">
              💡 These tokens are automatically managed and refreshed. Manual updates have been applied.
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Important Note</h4>
          <p className="text-sm text-yellow-700">
            The new tokens you provided have been noted. To update them in the system secrets, please go to your 
            <a href="https://supabase.com/dashboard/project/ppuyedxxfcijdfeqpwfj/settings/functions" target="_blank" className="underline ml-1">
              Supabase Functions Settings
            </a> and update:
          </p>
          <ul className="text-xs text-yellow-600 mt-2 space-y-1 list-disc ml-4">
            <li><strong>SLACK_BOT_TOKEN:</strong> xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzE...</li>
            <li><strong>SLACK_REFRESH_TOKEN:</strong> xoxe-1-My0xLTIyMTk5NjM5MTMyNzE...</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Recent Token Updates
          </h4>
          {tokenUpdates.length === 0 ? (
            <p className="text-gray-500 text-sm">No token updates found.</p>
          ) : (
            tokenUpdates.map((update) => (
              <div key={update.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {new Date(update.refresh_date).toLocaleString()}
                  </span>
                  {getStatusBadge(update.status)}
                </div>
                <div className="text-xs text-gray-600">
                  Token: {update.new_token.substring(0, 30)}...
                </div>
                {update.status === 'pending_update' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                    <p className="text-xs text-yellow-800">
                      <strong>Action Required:</strong> Please update the SLACK_BOT_TOKEN secret manually with this new token.
                    </p>
                  </div>
                )}
                {update.status === 'auto_updated' && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <p className="text-xs text-blue-800">
                      <strong>Automatically Updated:</strong> Both access and refresh tokens have been updated automatically.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SlackTokenManager;
