import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Shield, GraduationCap, Users, Mail, Lock, Sparkles } from "lucide-react";

type Role = "admin" | "teacher" | "trainer";
type AccountType = "teacher" | "trainer";

export default function UnifiedAuth() {
  const { toast } = useToast();
  
  // Login state
  const [loginRole, setLoginRole] = useState<Role>("admin");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Registration state
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Floating label states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Handle login based on selected role
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    try {
      if (loginRole === "teacher") {
        // Teacher login - uses numeric ID instead of email
        const teacherId = parseInt(loginEmail);
        if (isNaN(teacherId)) {
          toast({
            variant: "destructive",
            title: "Invalid Teacher ID",
            description: "Please enter a valid numeric Teacher ID",
          });
          setLoginLoading(false);
          return;
        }

        const response = await fetch("/api/teacher/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId, password: loginPassword }),
          credentials: "include",
        });

        if (response.ok) {
          const teacherData = await response.json();
          toast({
            title: "Welcome!",
            description: "Successfully logged in as Teacher",
          });
          // Force full page reload to ensure auth state is updated
          window.location.href = "/teacher/dashboard";
        } else {
          const error = await response.text();
          toast({
            variant: "destructive",
            title: "Login failed",
            description: error || "Invalid credentials",
          });
        }
      } else {
        // Admin/Trainer login - uses email
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            username: loginEmail, 
            password: loginPassword 
          }),
          credentials: "include",
        });

        if (response.ok) {
          const user = await response.json();
          
          // Verify role matches selection
          if (user.role !== loginRole) {
            toast({
              variant: "destructive",
              title: "Role mismatch",
              description: `This account is registered as ${user.role}, not ${loginRole}`,
            });
            setLoginLoading(false);
            return;
          }

          // Update the auth context's query cache
          queryClient.setQueryData(["/api/user"], user);

          toast({
            title: "Welcome!",
            description: `Successfully logged in as ${user.role}`,
          });
          
          // Force full page reload to ensure auth state is updated
          window.location.href = "/";
        } else {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: "Invalid email or password",
          });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during login",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle registration for Teacher or Trainer
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType) return;
    
    setRegLoading(true);

    try {
      if (accountType === "teacher") {
        // Create Teacher account
        const response = await fetch("/api/teacher/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: regName,
            email: regEmail,
            password: regPassword,
          }),
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          toast({
            title: "Account created!",
            description: `Your Teacher ID is: ${data.teacherId}. Please save this for login.`,
          });
          
          // Reset form and switch to login tab
          setRegName("");
          setRegEmail("");
          setRegPassword("");
          setAccountType(null);
          setLoginRole("teacher");
          setLoginEmail(data.teacherId.toString());
        } else {
          const error = await response.text();
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: error || "Could not create account",
          });
        }
      } else {
        // Create Trainer account
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: regEmail,
            password: regPassword,
            role: "trainer",
          }),
          credentials: "include",
        });

        if (response.ok) {
          toast({
            title: "Account created!",
            description: "You can now log in as a Trainer",
          });
          
          // Reset form and switch to login tab
          setRegName("");
          setRegEmail("");
          setRegPassword("");
          setAccountType(null);
          setLoginRole("trainer");
          setLoginEmail(regEmail);
        } else {
          const error = await response.text();
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: error || "Could not create account",
          });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during registration",
      });
    } finally {
      setRegLoading(false);
    }
  };

  const roleCards = [
    {
      value: "admin",
      icon: Shield,
      title: "Admin",
      description: "System administrator",
    },
    {
      value: "teacher",
      icon: GraduationCap,
      title: "Teacher",
      description: "Taking courses",
    },
    {
      value: "trainer",
      icon: Users,
      title: "Trainer",
      description: "Managing courses",
    }
  ];

  const motivationalQuotes = [
    "Education is the passport to the future.",
    "Learning never exhausts the mind.",
    "The beautiful thing about learning is that nobody can take it away from you.",
    "Education is not preparation for life; education is life itself.",
    "The capacity to learn is a gift; the ability to learn is a skill."
  ];

  const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Silverleaf Academy</CardTitle>
          <CardDescription>Training Program Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Create Account</TabsTrigger>
            </TabsList>

            {/* LOGIN TAB */}
            <TabsContent value="login" className="space-y-5">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Role Selection Cards */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Select your role</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {roleCards.map((role) => {
                      const Icon = role.icon;
                      const isSelected = loginRole === role.value;
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setLoginRole(role.value as Role)}
                          data-testid={`radio-${role.value}`}
                          className={`
                            relative p-3 rounded-md border-2 transition-all duration-200
                            hover-elevate active-elevate-2
                            ${isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border bg-card hover:border-primary/50'
                            }
                          `}
                        >
                          <div className="flex flex-col items-center gap-1.5 text-center">
                            <div className={`
                              p-2 rounded-md transition-all duration-200
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground'
                              }
                            `}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className={`font-medium text-xs ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                {role.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {role.description}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Email/ID Input with floating label */}
                <div className="relative">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                      id="login-email"
                      data-testid="input-login-email"
                      type={loginRole === "teacher" ? "number" : "email"}
                      placeholder=" "
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      required
                      className="pl-10 h-11 peer bg-card border-2 transition-all duration-200 focus:border-primary"
                    />
                    <Label
                      htmlFor="login-email"
                      className={`
                        absolute left-10 transition-all duration-200 pointer-events-none
                        ${emailFocused || loginEmail
                          ? '-top-2 left-2.5 text-xs bg-card px-1.5 text-primary font-medium'
                          : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground'
                        }
                      `}
                    >
                      {loginRole === "teacher" ? "Teacher ID" : "Email"}
                    </Label>
                  </div>
                  <div className={`h-0.5 bg-primary transition-all duration-200 ${emailFocused ? 'w-full' : 'w-0'}`} />
                </div>

                {/* Password Input with floating label */}
                <div className="relative">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                      id="login-password"
                      data-testid="input-login-password"
                      type="password"
                      placeholder=" "
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      required
                      className="pl-10 h-11 peer bg-card border-2 transition-all duration-200 focus:border-primary"
                    />
                    <Label
                      htmlFor="login-password"
                      className={`
                        absolute left-10 transition-all duration-200 pointer-events-none
                        ${passwordFocused || loginPassword
                          ? '-top-2 left-2.5 text-xs bg-card px-1.5 text-primary font-medium'
                          : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground'
                        }
                      `}
                    >
                      Password
                    </Label>
                  </div>
                  <div className={`h-0.5 bg-primary transition-all duration-200 ${passwordFocused ? 'w-full' : 'w-0'}`} />
                </div>

                {/* Login Button */}
                <Button 
                  type="submit" 
                  className="w-full h-11 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" 
                  disabled={loginLoading}
                  data-testid="button-login"
                >
                  {loginLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Logging in...
                    </span>
                  ) : (
                    "Login"
                  )}
                </Button>

                {/* Motivational Quote */}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground italic">
                      {randomQuote}
                    </p>
                  </div>
                </div>
              </form>
            </TabsContent>

            {/* REGISTER TAB */}
            <TabsContent value="register" className="space-y-4">
              {!accountType ? (
                <div className="space-y-4">
                  <Label className="text-base">Select account type to create:</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="outline"
                      className="h-20 text-base"
                      onClick={() => setAccountType("teacher")}
                      data-testid="button-create-teacher"
                    >
                      <div className="text-center">
                        <div className="font-semibold">Create Teacher Account</div>
                        <div className="text-xs text-muted-foreground">For teachers taking training courses</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 text-base"
                      onClick={() => setAccountType("trainer")}
                      data-testid="button-create-trainer"
                    >
                      <div className="text-center">
                        <div className="font-semibold">Create Trainer Account</div>
                        <div className="text-xs text-muted-foreground">For trainers managing courses</div>
                      </div>
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Create {accountType === "teacher" ? "Teacher" : "Trainer"} Account
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAccountType(null)}
                      data-testid="button-back"
                    >
                      ← Back
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input
                      id="reg-name"
                      data-testid="input-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      data-testid="input-email"
                      type="email"
                      placeholder="Enter your email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      data-testid="input-password"
                      type="password"
                      placeholder="Create a password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>

                  {accountType === "teacher" && (
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      A unique Teacher ID (starting from 7100) will be automatically generated for you. 
                      Please save it for future logins.
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={regLoading}
                    data-testid="button-register"
                  >
                    {regLoading ? "Creating Account..." : `Create ${accountType === "teacher" ? "Teacher" : "Trainer"} Account`}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
