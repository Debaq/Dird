import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut, Image, Users, MessageSquare, Radio, Settings, Bot, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { InstallationsList } from '@/components/admin/InstallationsList';
import { MessageBroadcast } from '@/components/admin/MessageBroadcast';
import { BeaconMonitor } from '@/components/admin/BeaconMonitor';
import { ContributionsList } from '@/components/admin/ContributionsList';
import { ChangePasswordForm } from '@/components/admin/ChangePasswordForm';
import { AIConfiguration } from '@/components/admin/AIConfiguration';
import { LogsViewer } from '@/components/admin/LogsViewer';
import { logoutAdmin } from '@/lib/api/admin-service';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('installations');

  const handleLogout = () => {
    logoutAdmin();
    toast.success('Sesión cerrada');
    navigate('/settings');
  };

  return (
    <div className="min-h-screen bg-smoke-50 dark:bg-dark-background">
      {/* Header */}
      <header className="bg-white dark:bg-dark-surface border-b border-smoke-200 dark:border-coal-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-coal-800 dark:text-dark-text">
                  Panel de Administración
                </h1>
                <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
                  DIRD - Sistema de Gestión
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
            <TabsTrigger value="installations" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Instalaciones</span>
            </TabsTrigger>
            <TabsTrigger value="contributions" className="gap-2">
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Contribuciones</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Mensajes</span>
            </TabsTrigger>
            <TabsTrigger value="beacons" className="gap-2">
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">Balizas</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">IA / Groq</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configuración</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="installations" className="space-y-4">
            <InstallationsList />
          </TabsContent>

          <TabsContent value="contributions" className="space-y-4">
            <ContributionsList />
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <MessageBroadcast />
          </TabsContent>

          <TabsContent value="beacons" className="space-y-4">
            <BeaconMonitor />
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <AIConfiguration />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <LogsViewer />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <ChangePasswordForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
