import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';

export interface LoadingProgress {
  step: 'init' | 'patient' | 'model' | 'images' | 'report' | 'done';
  current: number;
  total: number;
  message: string;
}

interface DemoLoadingScreenProps {
  progress: LoadingProgress;
}

export function DemoLoadingScreen({ progress }: DemoLoadingScreenProps) {
  const { t } = useTranslation();
  const [dots, setDots] = useState('');
  const [showLogo, setShowLogo] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animación de puntos suspensivos
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Calcular porcentaje total
  const getProgressPercentage = (): number => {
    const stepWeights = {
      init: 5,
      patient: 10,
      model: 15,   // Carga del modelo AI
      images: 55,  // Las imágenes son el proceso más pesado
      report: 10,
      done: 5,
    };

    const stepOrder = ['init', 'patient', 'model', 'images', 'report', 'done'];
    const currentStepIndex = stepOrder.indexOf(progress.step);

    // Calcular progreso acumulado de pasos anteriores
    let accumulatedProgress = 0;
    for (let i = 0; i < currentStepIndex; i++) {
      accumulatedProgress += stepWeights[stepOrder[i] as keyof typeof stepWeights];
    }

    // Calcular progreso del paso actual
    const currentStepWeight = stepWeights[progress.step];
    const currentStepProgress = progress.total > 0
      ? (progress.current / progress.total) * currentStepWeight
      : 0;

    return accumulatedProgress + currentStepProgress;
  };

  const percentage = getProgressPercentage();

  // Detectar cuando el progreso pasa del 50% y cambiar al logo
  useEffect(() => {
    if (percentage >= 50 && !showLogo && !isTransitioning) {
      setIsTransitioning(true);
      // Esperar a que termine la animación de rotación antes de cambiar el contenido
      setTimeout(() => {
        setShowLogo(true);
        setIsTransitioning(false);
      }, 600); // Duración de la animación de rotación
    }
  }, [percentage, showLogo, isTransitioning]);

  // Determinar la ruta base para las imágenes
  const basePath = import.meta.env.PROD ? '/dird' : '';

  return (
    <>
      <style>
        {`
          @keyframes spin-once {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary-50 via-snow to-primary-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="w-full max-w-md px-4">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <div
                className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 transition-transform duration-600 ${
                  isTransitioning ? 'animate-spin-once' : ''
                }`}
                style={{
                  animation: isTransitioning ? 'spin-once 0.6s ease-in-out' : undefined
                }}
              >
                {showLogo ? (
                  <img
                    src={`${basePath}/logo.svg`}
                    alt="DIRD Logo"
                    className="h-14 w-14"
                  />
                ) : (
                  <svg
                    className="h-12 w-12 text-primary-600 dark:text-primary-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </div>
              <CardTitle className="text-2xl">{t('demo.loading.title')}</CardTitle>
              <CardDescription>
                {t('demo.loading.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-coal-700 dark:text-gray-300">
                    {progress.message}{dots}
                  </span>
                  <span className="font-semibold text-primary-600 dark:text-primary-400">
                    {Math.round(percentage)}%
                  </span>
                </div>
                <Progress value={percentage} className="h-3" />
              </div>

              {progress.step === 'images' && progress.total > 0 && (
                <div className="text-center text-xs text-smoke-500 dark:text-gray-400">
                  {t('demo.loading.imagesProgress', {
                    current: progress.current,
                    total: progress.total
                  })}
                </div>
              )}

              <div className="rounded-lg bg-primary-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-coal-600 dark:text-gray-300">
                  {t('demo.loading.firstTimeInfo')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
