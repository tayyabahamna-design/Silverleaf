import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation, useRoute } from "wouter";
import { Download, ArrowLeft, LogOut } from "lucide-react";
import logoImage from "@assets/image_1760460046116.png";

interface Certificate {
  id: string;
  teacherName: string;
  courseName: string;
  appreciationText: string;
  adminName1?: string;
  adminName2?: string;
  generatedAt: string;
  batchId: string;
}

export default function TeacherCertificateView() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/teacher/certificates/:certId");

  const certId = params?.certId;

  const { data: certificate, isLoading } = useQuery({
    queryKey: ["/api/teacher", user?.id, "certificates", certId],
    enabled: !!user?.id && !!certId,
  });

  if (!user || user.role !== "teacher") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">This page is for teachers only.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading certificate...</p>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Certificate Not Found</h1>
          <Button onClick={() => navigate("/teacher/certificates")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Certificates
          </Button>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary shadow-md no-print">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Certificate</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/teacher/certificates")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex justify-center">
        {/* Certificate Card */}
        <Card className="w-full max-w-4xl p-12 bg-white text-black print:p-0 print:shadow-none">
          <div className="text-center space-y-8">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-primary rounded-sm p-2">
                <img src={logoImage} alt="Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-5xl font-bold text-primary">Certificate of Completion</h1>
              <p className="text-lg text-gray-600">Silverleaf Academy</p>
            </div>

            {/* Divider */}
            <div className="h-1 bg-primary w-24 mx-auto" />

            {/* Content */}
            <div className="space-y-6 py-8">
              <p className="text-xl font-semibold">This certificate is proudly presented to</p>
              
              <div className="border-b-4 border-primary pb-4">
                <p className="text-4xl font-bold text-primary">{certificate.teacherName}</p>
              </div>

              <div className="space-y-4">
                <p className="text-lg">For successfully completing the course:</p>
                <p className="text-2xl font-bold text-primary">{certificate.courseName}</p>
              </div>

              <div className="bg-primary/10 p-6 rounded-lg">
                <p className="text-base leading-relaxed italic text-gray-700">
                  {certificate.appreciationText}
                </p>
              </div>

              <p className="text-sm text-gray-500">
                Issued on {new Date(certificate.generatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8">
              <div className="space-y-12">
                <div className="h-24" />
                <div>
                  <p className="font-semibold">{certificate.adminName1 || "Administrator"}</p>
                  <p className="text-sm text-gray-600">Authorized Signatory</p>
                </div>
              </div>
              <div className="space-y-12">
                <div className="h-24" />
                <div>
                  <p className="font-semibold">{certificate.adminName2 || "Director"}</p>
                  <p className="text-sm text-gray-600">Program Director</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>

      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .no-print {
            display: none;
          }
          main {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
