import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import DashboardHeader from '@/components/DashboardHeader';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';

interface RechargeRequest {
  id: number;
  user: number;
  user_name: string;
  user_email: string;
  wallet: number;
  amount: string;
  project_details?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  status_display: string;
  approved_by_email?: string;
  response_message?: string;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  department_id?: number;
  department_name?: string;
}

const WalletRechargeRequestAction = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RechargeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchRequest = async () => {
      if (!requestId) {
        setError('Request ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.getWalletRechargeRequests();
        
        if (response.error) {
          setError(response.error);
          return;
        }

        const requests = response.data?.requests || [];
        const foundRequest = requests.find((r: RechargeRequest) => r.id === parseInt(requestId));
        
        if (!foundRequest) {
          setError('Recharge request not found');
          return;
        }

        // Set request even if not pending - we'll show details and status
        setRequest(foundRequest);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch recharge request');
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [requestId]);

  const handleApprove = async () => {
    if (!requestId) return;

    setSubmitting(true);
    try {
      const response = await apiClient.approveWalletRechargeRequest(
        parseInt(requestId),
        responseMessage.trim() || undefined
      );

      if (response.error) {
        toast.error(response.error || 'Failed to approve request');
        return;
      }

      toast.success(response.data?.message || 'Request approved successfully');
      navigate('/wallet');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!requestId) return;

    if (!responseMessage.trim()) {
      toast.error('Response message is required for rejection');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.rejectWalletRechargeRequest(
        parseInt(requestId),
        responseMessage.trim()
      );

      if (response.error) {
        toast.error(response.error || 'Failed to reject request');
        return;
      }

      toast.success(response.data?.message || 'Request rejected successfully');
      navigate('/wallet');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading recharge request...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Error</h2>
                <p className="text-muted-foreground mb-4">{error || 'Request not found'}</p>
                <Button onClick={() => navigate('/wallet')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Wallet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button onClick={() => navigate('/wallet')} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Wallet
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Wallet Recharge Request</CardTitle>
            <CardDescription>Request ID: #{request.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Request Details */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p className="font-medium">{request.user_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{request.user_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium text-lg text-green-600">₹{request.amount}</p>
                </div>
                {request.department_name && (
                  <div>
                    <Label className="text-muted-foreground">Department</Label>
                    <p className="font-medium">{request.department_name}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Request Date</Label>
                  <p className="font-medium">
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="font-medium">
                    <span className={`px-2 py-1 rounded text-sm ${
                      request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      request.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {request.status_display}
                    </span>
                  </p>
                </div>
              </div>
              {request.project_details && (
                <div>
                  <Label className="text-muted-foreground">Project Details</Label>
                  <p className="font-medium mt-1">{request.project_details}</p>
                </div>
              )}
              {request.response_message && (
                <div className="pt-4 border-t">
                  <Label className="text-muted-foreground">
                    {request.status === 'APPROVED' ? 'Approval' : request.status === 'REJECTED' ? 'Rejection' : 'Response'} Message
                  </Label>
                  <div className={`mt-2 p-3 rounded-md ${
                    request.status === 'APPROVED' ? 'bg-green-50 border border-green-200' :
                    request.status === 'REJECTED' ? 'bg-red-50 border border-red-200' :
                    'bg-gray-50 border border-gray-200'
                  }`}>
                    <p className={`font-medium ${
                      request.status === 'APPROVED' ? 'text-green-900' :
                      request.status === 'REJECTED' ? 'text-red-900' :
                      'text-gray-900'
                    }`}>
                      {request.response_message}
                    </p>
                  </div>
                </div>
              )}
              {request.approved_by_email && (
                <div>
                  <Label className="text-muted-foreground">
                    {request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : 'Processed'} By
                  </Label>
                  <p className="font-medium">{request.approved_by_email}</p>
                </div>
              )}
              {request.responded_at && (
                <div>
                  <Label className="text-muted-foreground">
                    {request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : 'Responded'} At
                  </Label>
                  <p className="font-medium">
                    {new Date(request.responded_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Action Selection - Only show if pending */}
            {!action && request.status === 'PENDING' && (
              <div className="space-y-4 pt-4 border-t">
                <Label>Select Action</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => setAction('approve')}
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    variant="outline"
                  >
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <span className="font-semibold">Approve</span>
                    <span className="text-xs text-muted-foreground">Optional message</span>
                  </Button>
                  <Button
                    onClick={() => setAction('reject')}
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    variant="outline"
                  >
                    <XCircle className="h-8 w-8 text-red-600" />
                    <span className="font-semibold">Reject</span>
                    <span className="text-xs text-muted-foreground">Message required</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Show message if request is already processed */}
            {request.status !== 'PENDING' && !action && (
              <div className="pt-4 border-t">
                <div className={`p-4 rounded-md ${
                  request.status === 'APPROVED' ? 'bg-green-50 border border-green-200' :
                  request.status === 'REJECTED' ? 'bg-red-50 border border-red-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <p className={`font-medium ${
                    request.status === 'APPROVED' ? 'text-green-900' :
                    request.status === 'REJECTED' ? 'text-red-900' :
                    'text-gray-900'
                  }`}>
                    This request has already been {request.status.toLowerCase()}.
                    {request.response_message && ' See the response message above for details.'}
                  </p>
                </div>
              </div>
            )}

            {/* Action Form */}
            {action && request.status === 'PENDING' && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label htmlFor="response-message">
                    Response Message {action === 'reject' && <span className="text-destructive">*</span>}
                    {action === 'approve' && <span className="text-muted-foreground"> (Optional)</span>}
                  </Label>
                  <Textarea
                    id="response-message"
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder={action === 'approve' ? 'Optional message to the user...' : 'Please provide a reason for rejection...'}
                    rows={4}
                    className="mt-2"
                    required={action === 'reject'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {action === 'approve' 
                      ? 'This message will be sent to the user'
                      : 'This message is required and will be sent to the user'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={action === 'approve' ? handleApprove : handleReject}
                    disabled={submitting || (action === 'reject' && !responseMessage.trim())}
                    className="flex-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {action === 'approve' ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve Request
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject Request
                          </>
                        )}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setAction(null);
                      setResponseMessage('');
                    }}
                    variant="outline"
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WalletRechargeRequestAction;
