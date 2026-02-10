import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";

interface ProfileSettingsDialogProps {
  /** 'admin' for admin/trainer users, 'teacher' for teacher users */
  userType: "admin" | "teacher";
  currentEmail?: string;
  trigger?: React.ReactNode;
}

export function ProfileSettingsDialog({
  userType,
  currentEmail,
  trigger,
}: ProfileSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("password");
  const { toast } = useToast();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Email change state
  const [emailPassword, setEmailPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const passwordEndpoint =
    userType === "admin"
      ? "/api/profile/change-password"
      : "/api/teacher/profile/change-password";

  const emailEndpoint =
    userType === "admin"
      ? "/api/profile/change-email"
      : "/api/teacher/profile/change-email";

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters");
      }
      const res = await fetch(passwordEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Password Changed",
        description: data.message || "Your password has been updated for all linked accounts.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: async () => {
      if (!newEmail || !newEmail.includes("@")) {
        throw new Error("Please enter a valid email address");
      }
      const res = await fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: emailPassword, newEmail }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change email");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Email Changed",
        description: data.message || "Your email has been updated for all linked accounts.",
      });
      setEmailPassword("");
      setNewEmail("");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEmailPassword("");
    setNewEmail("");
    setActiveTab("password");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="secondary"
            size="icon"
            data-testid="button-profile-settings"
            className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            <Settings className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Change Password</TabsTrigger>
            <TabsTrigger value="email">Change Email</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <PasswordInput
                  id="currentPassword"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <PasswordInput
                  id="newPassword"
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <PasswordInput
                  id="confirmPassword"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Changing your password will update it for all linked accounts (admin/trainer and teacher).
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => changePasswordMutation.mutate()}
                disabled={
                  changePasswordMutation.isPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                data-testid="button-change-password"
              >
                {changePasswordMutation.isPending
                  ? "Changing..."
                  : "Change Password"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 py-4">
            {currentEmail && (
              <div className="space-y-2">
                <Label>Current Email</Label>
                <Input value={currentEmail} disabled />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="Enter new email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                data-testid="input-new-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailPassword">Password</Label>
              <div className="relative">
                <PasswordInput
                  id="emailPassword"
                  placeholder="Enter your password to confirm"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  data-testid="input-email-password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Changing your email will update it for all linked accounts (admin/trainer and teacher).
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => changeEmailMutation.mutate()}
                disabled={
                  changeEmailMutation.isPending ||
                  !emailPassword ||
                  !newEmail
                }
                data-testid="button-change-email"
              >
                {changeEmailMutation.isPending
                  ? "Changing..."
                  : "Change Email"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
