import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Github, Coffee, Send, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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
  const [isSubmittingImages, setIsSubmittingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pendingImages = useLiveQuery(
    () => db.images.where('contributionStatus').equals('pending').toArray()
  );

  const handleImageClick = async (image: Image) => {
    try {
      const session = await db.sessions.get(image.sessionId);
      if (!session) return;
      navigate(`/patients/${session.patientId}/sessions/${session.id}/images/${image.id}`);
    } catch (error) {
      // Error handling without logging
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Logic for submitting comments
    toast.success(t('contribution.feedback.success'));
    setComment('');
  };

  const handleImageSubmission = async () => {
    if (!pendingImages || pendingImages.length === 0) return;
    
    setIsSubmittingImages(true);
    setUploadProgress(0);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const totalImages = pendingImages.length;

      for (let i = 0; i < totalImages; i++) {
        const img = pendingImages[i];
        try {
            // Get detections
            const detections = await db.detections.where('imageId').equals(img.id!).toArray();
            
            const formData = new FormData();
            formData.append('image', img.originalBlob, img.filename);
            
            const jsonBlob = new Blob([JSON.stringify(detections, null, 2)], { type: 'application/json' });
            formData.append('json', jsonBlob, `${img.filename.split('.')[0]}.json`);

            // Determine API URL based on environment
            const baseUrl = import.meta.env.BASE_URL || '/';
            // Ensure baseUrl starts and ends with /
            const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            const apiUrl = `${normalizedBase}backend/receive_contribution.php`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to upload ${img.filename}`);
            }
            
            // Update status in local DB
            await db.images.update(img.id!, { contributionStatus: 'submitted' });
            successCount++;
        } catch (err) {
            errorCount++;
        }

        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalImages) * 100));
      }
      
      // Small delay to let the user see the 100% bar
      await new Promise(resolve => setTimeout(resolve, 500));

      if (successCount > 0) {
          toast.success(t('contribution.images.success', { count: successCount }) + (errorCount > 0 ? t('contribution.images.failedCount', { count: errorCount }) : ''));
          setAcceptedTerms(false);
      } else if (errorCount > 0) {
          toast.error(t('contribution.images.error'));
      }

    } catch (error) {
        toast.error(t('contribution.images.generalError'));
    } finally {
        setIsSubmittingImages(false);
        setUploadProgress(0);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl dark:text-gray-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-coal-800 dark:text-gray-100 flex items-center gap-3">
          <Coffee className="h-8 w-8 text-amber-500" />
          {t('contribution.title')}
        </h1>
        <p className="text-smoke-600 dark:text-gray-400 mt-2">
          {t('contribution.description')}
        </p>
      </div>

      {/* GitHub Links Section */}
      <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <Github className="h-5 w-5" />
          {t('contribution.github.title')}
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
                {t('contribution.github.appDescription')}
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
                {t('contribution.github.modelsDescription')}
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
          {t('contribution.donation.title')}
        </h2>
        <p className="text-smoke-600 dark:text-dark-textSecondary mb-4">
          {t('contribution.donation.description')}
        </p>
        <a
          href="https://ko-fi.com/tecmedhub"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">
            <Coffee className="h-4 w-4 mr-2" />
            {t('contribution.donation.button')}
          </Button>
        </a>
      </Card>

      {/* Image Contribution Section - Only Visible if there are pending images */}
      {pendingImages && pendingImages.length > 0 && (
        <Card className="p-6 mb-8 dark:bg-dark-surface dark:border-coal-700 border-l-4 border-l-amber-500">
          <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-amber-600" />
            {t('contribution.images.title')}
          </h2>
          
          <div className="mb-6">
            <p className="text-sm text-smoke-600 dark:text-gray-400 mb-4">
                {t('contribution.images.pendingMessage', { count: pendingImages.length })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
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

            <div className="flex items-start space-x-2 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800/30 mb-4">
                 <input 
                    type="checkbox" 
                    id="terms" 
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    disabled={isSubmittingImages}
                 />
                 <Label htmlFor="terms" className="text-sm cursor-pointer leading-tight text-coal-700 dark:text-gray-300">
                     {t('contribution.images.terms')}
                 </Label>
             </div>

            {isSubmittingImages && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-smoke-500 mb-1">
                  <span>{t('contribution.images.sending')}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button 
                onClick={handleImageSubmission}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                disabled={!acceptedTerms || isSubmittingImages}
            >
                {isSubmittingImages ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        {t('contribution.images.sending')}
                    </>
                ) : (
                    <>
                        <Send className="h-4 w-4 mr-2" />
                        {t('contribution.images.submit', { count: pendingImages.length })}
                    </>
                )}
            </Button>
          </div>
        </Card>
      )}

      {/* Feedback Section */}
      <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
        <h2 className="text-xl font-semibold text-coal-800 dark:text-dark-text mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t('contribution.feedback.title')}
        </h2>
        <form onSubmit={handleCommentSubmit} className="space-y-6">
          <div>
            <Label htmlFor="component" className="dark:text-dark-text">
              {t('contribution.feedback.component')}
            </Label>
            <Select
              value={selectedComponent}
              onValueChange={(value) => setSelectedComponent(value as 'dird' | 'dird-models')}
              options={[
                { value: 'dird', label: t('contribution.feedback.dirdApp') },
                { value: 'dird-models', label: t('contribution.feedback.dirdModels') }
              ]}
              placeholder={t('contribution.feedback.selectComponent')}
            />
          </div>

          <div>
            <Label htmlFor="comment" className="dark:text-dark-text">
              {t('contribution.feedback.comment')}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('contribution.feedback.placeholder')}
              className="mt-2 min-h-[120px] dark:bg-dark-surface dark:border-coal-600 dark:text-dark-text"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            variant="secondary"
          >
            <Send className="h-4 w-4 mr-2" />
            {t('contribution.feedback.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ContributionMenu;