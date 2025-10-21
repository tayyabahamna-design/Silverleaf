import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

type Role = "admin" | "teacher" | "trainer";
type AccountType = "teacher" | "trainer";

export default function UnifiedAuth() {
  const [, setLocation] = useLocation();
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
          toast({
            title: "Welcome!",
            description: "Successfully logged in as Teacher",
          });
          setLocation("/teacher-dashboard");
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

          toast({
            title: "Welcome!",
            description: `Successfully logged in as ${user.role}`,
          });
          
          // Route based on role
          if (user.role === "admin") {
            setLocation("/");
          } else if (user.role === "trainer") {
            setLocation("/");
          }
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
            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Please select your role before logging in:</Label>
                  <RadioGroup 
                    value={loginRole} 
                    onValueChange={(value) => setLoginRole(value as Role)}
                    className="flex flex-col space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="admin" id="role-admin" data-testid="radio-admin" />
                      <Label htmlFor="role-admin" className="cursor-pointer">Admin</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="teacher" id="role-teacher" data-testid="radio-teacher" />
                      <Label htmlFor="role-teacher" className="cursor-pointer">Teacher</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="trainer" id="role-trainer" data-testid="radio-trainer" />
                      <Label htmlFor="role-trainer" className="cursor-pointer">Trainer</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-email">
                    {loginRole === "teacher" ? "Teacher ID" : "Email"}
                  </Label>
                  <Input
                    id="login-email"
                    data-testid="input-login-email"
                    type={loginRole === "teacher" ? "number" : "email"}
                    placeholder={loginRole === "teacher" ? "Enter your Teacher ID (e.g., 7100)" : "Enter your email"}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    data-testid="input-login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loginLoading}
                  data-testid="button-login"
                >
                  {loginLoading ? "Logging in..." : "Login"}
                </Button>
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
                      📝 A unique Teacher ID (starting from 7100) will be automatically generated for you. 
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
