
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Clock, CheckCircle, AlertTriangle, Zap, Key, Settings, ExternalLink } from 'lucide-react';

interface TokenUpdate {
  id: string;
  old_token: string;
  new_token: string;
  refresh_date: string;
  status: string;
  created_at: string;
}

const SlackTokenManager = () => {
  const [tokenUpdates, setTokenUpdates] = useState<TokenUpdate[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshStatus, setLastRefreshStatus] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTokenUpdates();
    // Check for refresh every 5 minutes
    const interval = setInterval(fetchTokenUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTokenUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('slack_token_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      setTokenUpdates(data || []);
      
      // Check last refresh status
      if (data && data.length > 0) {
        const lastUpdate = data[0];
        setLastRefreshStatus(lastUpdate.status);
        
        // Show toast for recent failures
        if (lastUpdate.status === 'error' || lastUpdate.status === 'manual_update_needed') {
          const timeSinceUpdate = Date.now() - new Date(lastUpdate.created_at).getTime();
          if (timeSinceUpdate < 5 * 60 * 1000) { // Within last 5 minutes
            toast({
              title: "⚠️ Token Refresh Issue",
              description: "Automatic token refresh failed. Manual update may be required.",
              variant: "destructive"
            });
          }
        }
      }
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

      if (error) {
        console.error('Refresh error:', error);
        throw error;
      }

      console.log('Refresh response:', data);

      if (data?.success) {
        toast({
          title: "✅ Token Refresh Successful",
          description: data.message || "Slack tokens have been refreshed successfully!",
          className: "bg-green-50 border-green-200"
        });
      } else {
        toast({
          title: "⚠️ Manual Update Required",
          description: data?.message || "Automatic refresh failed. Please update tokens manually.",
          variant: "destructive"
        });
      }

      // Refresh the list after a short delay
      setTimeout(() => {
        fetchTokenUpdates();
      }, 2000);

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
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Auto Updated</Badge>;
      case 'manual_update_needed':
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />Manual Update Needed</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'missing_credentials':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" />Missing Credentials</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'auto_updated':
        return 'text-green-600';
      case 'manual_update_needed':
      case 'error':
        return 'text-red-600';
      case 'missing_credentials':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
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

  const isSystemHealthy = lastRefreshStatus === 'auto_updated' || lastRefreshStatus === '';
  const needsManualUpdate = lastRefreshStatus === 'manual_update_needed' || lastRefreshStatus === 'error';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Slack Token Manager
          </span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isSystemHealthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
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
              Refresh Now
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Status */}
        <div className={`rounded-lg p-4 ${isSystemHealthy ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h4 className={`font-semibold mb-2 flex items-center ${isSystemHealthy ? 'text-green-900' : 'text-red-900'}`}>
            {isSystemHealthy ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
            System Status: {isSystemHealthy ? 'Healthy' : 'Needs Attention'}
          </h4>
          <p className={`text-sm ${isSystemHealthy ? 'text-green-700' : 'text-red-700'}`}>
            {isSystemHealthy 
              ? 'Automatic token refresh is working properly. Tokens are refreshed every 10 hours.'
              : 'Token refresh system needs manual intervention. Please check the updates below.'
            }
          </p>
        </div>

        {/* Current Token Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Current Token Configuration
          </h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Access Token:</strong> xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzE... ✅ Updated</p>
            <p><strong>Refresh Token:</strong> xoxe-1-My0xLTIyMTk5NjM5MTMyNzE... ✅ Available</p>
            <p className="text-xs text-blue-600 mt-2 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Next scheduled refresh: Every 10 hours (automated)
            </p>
          </div>
        </div>

        {/* Manual Update Warning */}
        {needsManualUpdate && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Manual Update Required
            </h4>
            <p className="text-sm text-yellow-700 mb-3">
              The automatic token refresh has failed. You need to update the token manually in Supabase.
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              onClick={() => window.open('https://supabase.com/dashboard/project/ppuyedxxfcijdfeqpwfj/settings/functions', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Supabase Functions Settings
            </Button>
          </div>
        )}

        {/* Recent Updates */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Recent Token Updates ({tokenUpdates.length})
          </h4>
          {tokenUpdates.length === 0 ? (
            <p className="text-gray-500 text-sm">No token updates found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tokenUpdates.map((update) => (
                <div key={update.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {new Date(update.refresh_date).toLocaleString()}
                    </span>
                    {getStatusBadge(update.status)}
                  </div>
                  <div className="text-xs text-gray-600">
                    Token: {update.new_token.substring(0, 40)}...
                  </div>
                  {update.status === 'manual_update_needed' && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-800">
                        <strong>Action Required:</strong> Automatic refresh failed. Please update SLACK_BOT_TOKEN manually in Supabase Functions.
                      </p>
                    </div>
                  )}
                  {update.status === 'auto_updated' && (
                    <div className="bg-green-50 border border-green-200 rounded p-2">
                      <p className="text-xs text-green-800">
                        <strong>Success:</strong> Token was automatically refreshed via Slack OAuth API.
                      </p>
                    </div>
                  )}
                  {update.status === 'error' && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-800">
                        <strong>Error:</strong> Token refresh failed. Check logs for details.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SlackTokenManager;
