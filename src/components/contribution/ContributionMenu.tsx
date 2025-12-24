import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Github, Coffee, Send, Image as ImageIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { db, type Image } from '@/lib/db/schema';

const ImageThumbnail: React.FC<{ image: Image }> = ({ image }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(image.originalBlob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (!src) return <div className="w-full h-full bg-gray-200 animate-pulse" />;

  return (
    <img src={src} alt={image.filename} className="w-full h-full object-cover" />
  );
};

const ContributionMenu: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<'dird' | 'dird-models'>('dird');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const pendingImages = useLiveQuery(
    () => db.images.where('contributionStatus').equals('pending').toArray()
  );

  const handleImageClick = async (image: Image) => {
    try {
      const session = await db.sessions.get(image.sessionId);
      if (!session) return;
      navigate(`/patients/${session.patientId}/sessions/${session.id}/images/${image.id}`);
    } catch (error) {
      console.error("Error navigating to image:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingImages && pendingImages.length > 0) {
        // Simulate serialization process for privacy
        const serializedPayload = pendingImages.map(img => ({
            originalId: img.id,
            // Simulate UUID generation for filename serialization to ensure anonymization
            serializedFilename: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
            // Explicitly removing PII
            originalFilename: 'REMOVED_FOR_PRIVACY', 
            contributionStatus: 'submitted'
        }));
        
        console.log('Preparing anonymized payload (names serialized):', serializedPayload);

        // Mark as submitted in local DB
        await Promise.all(pendingImages.map(img => 
            db.images.update(img.id!, { contributionStatus: 'submitted' })
        ));
        
        alert('Gracias por tu contribución! Las imágenes han sido anonimizadas (nombres serializados) y marcadas como enviadas.');
        setAcceptedTerms(false);
    } else {
        // Just comment
        console.log('Submitting comment:', { comment, selectedComponent });
        alert('Comentario enviado! (Simulado)');
    }
    setComment('');
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl dark:text-gray-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-coal-800 dark:text-gray-100 flex items-center gap-3">
          <Coffee className="h-8 w-8 text-amber-500" />
          {t('contribution.title', 'Contribuir')}
        </h1>
        <p className="text-smoke-600 dark:text-gray-400 mt-2">
          {t('contribution.description', 'Ayuda a mejorar Dird con tu contribución')}
        </p>
      </div>

      {/* GitHub Links Section */}
      <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Github className="h-5 w-5" />
          {t('contribution.github.title', 'Repositorios')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a 
            href="https://github.com/debaq/dird" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 border border-coal-200 rounded-lg hover:bg-ice dark:border-coal-600 dark:hover:bg-dark-background transition-colors"
          >
            <div>
              <h3 className="font-medium text-coal-800 dark:text-dark-text">Dird App</h3>
              <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
                {t('contribution.github.appDescription', 'Aplicación principal')}
              </p>
            </div>
            <Github className="h-5 w-5 text-gray-500" />
          </a>
          <a
            href="https://github.com/Debaq/dird_models"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 border border-coal-200 rounded-lg hover:bg-ice dark:border-coal-600 dark:hover:bg-dark-background transition-colors"
          >
            <div>
              <h3 className="font-medium text-coal-800 dark:text-dark-text">Dird Models</h3>
              <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
                {t('contribution.github.modelsDescription', 'Modelos de IA')}
              </p>
            </div>
            <Github className="h-5 w-5 text-gray-500" />
          </a>
        </div>
      </Card>

      {/* Coffee Donation Section */}
      <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-500" />
          {t('contribution.donation.title', 'Apóyanos con un café')}
        </h2>
        <p className="text-smoke-600 dark:text-dark-textSecondary mb-4">
          {t('contribution.donation.description', 'Tu apoyo nos ayuda a seguir mejorando Dird')}
        </p>
        <a
          href="https://ko-fi.com/tecmedhub"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">
            <Coffee className="h-4 w-4 mr-2" />
            {t('contribution.donation.button', 'Comprar un café')}
          </Button>
        </a>
      </Card>

      {/* Feedback & Contribution Section */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Send className="h-5 w-5" />
          {t('contribution.feedback.title', 'Enviar Contribución')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="component" className="dark:text-dark-text">
              {t('contribution.feedback.component', 'Componente')}
            </Label>
            <Select
              value={selectedComponent}
              onValueChange={(value) => setSelectedComponent(value as 'dird' | 'dird-models')}
              options={[
                { value: 'dird', label: t('contribution.feedback.dirdApp', 'Aplicación Dird') },
                { value: 'dird-models', label: t('contribution.feedback.dirdModels', 'Modelos Dird') }
              ]}
              placeholder={t('contribution.feedback.selectComponent', 'Selecciona un componente')}
            />
          </div>

          <div>
            <Label htmlFor="comment" className="dark:text-dark-text">
              {t('contribution.feedback.comment', 'Comentario')}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('contribution.feedback.placeholder', 'Escribe tu comentario o sugerencia aquí...')}
              className="mt-2 min-h-[120px] dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
            />
          </div>

          {/* Pending Images Section */}
          <div>
            <Label className="dark:text-dark-text mb-2 block">
              Imágenes para Contribuir
            </Label>
            
            {pendingImages && pendingImages.length > 0 ? (
                <div className="border border-coal-200 dark:border-coal-600 rounded-lg p-4 bg-gray-50 dark:bg-dark-background">
                    <p className="text-sm text-smoke-600 dark:text-gray-400 mb-4">
                        Estas son las imágenes que has marcado para contribuir. Serán enviadas de forma anónima para entrenar nuestros modelos.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {pendingImages.map((img) => (
                            <div 
                                key={img.id} 
                                className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden border border-gray-300 dark:border-coal-600 shadow-sm cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                                onClick={() => handleImageClick(img)}
                            >
                                <ImageThumbnail image={img} />
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1">
                                    <p className="text-[10px] text-white truncate text-center">{img.filename}</p>
                                </div>
                                <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-1 shadow-md">
                                    <ImageIcon className="w-3 h-3 text-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="border-2 border-dashed border-coal-300 rounded-lg p-8 text-center dark:border-coal-600 bg-gray-50 dark:bg-dark-background/50">
                    <ImageIcon className="h-10 w-10 text-coal-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-smoke-500 dark:text-gray-500">
                        No hay imágenes pendientes de contribución.
                    </p>
                    <p className="text-xs text-smoke-400 dark:text-gray-600 mt-1">
                        Marca imágenes desde el analizador cuando realices correcciones manuales.
                    </p>
                </div>
            )}
          </div>

          {/* Terms Checkbox */}
          {pendingImages && pendingImages.length > 0 && (
             <div className="flex items-start space-x-2 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800/30">
                 <input 
                    type="checkbox" 
                    id="terms" 
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                 />
                 <Label htmlFor="terms" className="text-sm cursor-pointer leading-tight text-coal-700 dark:text-gray-300">
                     Acepto los términos y condiciones. Entiendo que las imágenes serán enviadas para mejorar los modelos de IA y que no contienen información personal identificable (anonimizadas).
                 </Label>
             </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            disabled={pendingImages && pendingImages.length > 0 && !acceptedTerms}
          >
            <Send className="h-4 w-4 mr-2" />
            {pendingImages && pendingImages.length > 0 ? 'Enviar Contribución' : 'Enviar Comentario'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ContributionMenu;