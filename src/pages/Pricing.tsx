import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, ArrowLeft, Loader2, Crown, Settings } from "lucide-react";

const Pricing = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    
    if (session) {
      checkSubscription();
    }
  };

  const checkSubscription = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;
      
      setCurrentPlan(data.plan || "free");
      setSubscriptionEnd(data.subscription_end);
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    if (!isAuthenticated) {
      navigate("/auth?mode=signup");
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan }
      });
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const plans = [
    {
      name: "Free",
      id: "free",
      price: "$0",
      period: "/month",
      features: [
        "5 resume analyses per month",
        "Basic risk indicators",
        "7-day history",
        "Email support"
      ],
      current: currentPlan === "free",
      action: null
    },
    {
      name: "Pro",
      id: "pro",
      price: "$49",
      period: "/month",
      features: [
        "100 resume analyses per month",
        "Detailed AI explanations",
        "Unlimited history",
        "Downloadable PDF reports",
        "Priority support"
      ],
      current: currentPlan === "pro",
      popular: true,
      action: currentPlan === "pro" ? "manage" : (currentPlan === "enterprise" ? null : "upgrade")
    },
    {
      name: "Enterprise",
      id: "enterprise",
      price: "$99",
      period: "/month",
      features: [
        "Unlimited resume analyses",
        "Team workspaces & collaboration",
        "API integration",
        "Custom AI prompts",
        "Dedicated support",
        "SLA guarantee"
      ],
      current: currentPlan === "enterprise",
      action: currentPlan === "enterprise" ? "manage" : "upgrade"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">ResumeVerify</span>
          </Link>
          <div className="flex-1" />
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button>Sign In</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade when you need more. All plans include our core AI-powered resume verification.
          </p>
          
          {currentPlan === "pro" && subscriptionEnd && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">
                Pro subscription renews on {formatDate(subscriptionEnd)}
              </span>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : "border-border"} ${plan.current ? "ring-2 ring-primary" : ""}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              {plan.current && (
                <Badge variant="secondary" className="absolute -top-3 right-4">
                  Current Plan
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.action === "upgrade" && (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>
                )}

                {plan.action === "manage" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleManageSubscription}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Settings className="mr-2 h-4 w-4" />
                        Manage Subscription
                      </>
                    )}
                  </Button>
                )}


                {!plan.action && plan.current && (
                  <Button variant="secondary" className="w-full" disabled>
                    Current Plan
                  </Button>
                )}

                {!plan.action && !plan.current && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/auth?mode=signup")}
                  >
                    Get Started
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-foreground mb-2">
                What happens if I exceed my monthly limit?
              </h3>
              <p className="text-sm text-muted-foreground">
                You won't be able to analyze new resumes until the next billing cycle. Upgrade to Pro for 100 analyses per month.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">
                Can I cancel my subscription anytime?
              </h3>
              <p className="text-sm text-muted-foreground">
                Yes, you can cancel anytime through the customer portal. Your access continues until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">
                Is my data secure?
              </h3>
              <p className="text-sm text-muted-foreground">
                Absolutely. We use enterprise-grade encryption and never share your resume data with third parties.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
