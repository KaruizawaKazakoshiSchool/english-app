import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVocabulary } from '../../../hooks/useVocabulary';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { Button } from '../../ui/Button';
import { ArrowLeft } from 'lucide-react';
import { TypingTrainer } from '../../common/TypingTrainer';

export const TypingPractice: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const decodedCategory = decodeURIComponent(category || '');
  const { speak } = useSpeechSynthesis();
  const vocabulary = useVocabulary();

  const words = React.useMemo(
    () => vocabulary
      .filter(v => v.category === decodedCategory)
      .map(v => ({ text: v.english, emoji: v.emoji, imageUrl: v.imageUrl })),
    [decodedCategory, vocabulary]
  );

  return (
    <div className="flex-col flex-center gap-md" style={{ minHeight: '100%', width: '100%' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" onClick={() => navigate(`/dictionary/${category}`)} icon={ArrowLeft}>
          もどる
        </Button>
        <h1 className="text-primary" style={{ fontSize: '1.8rem', margin: 0 }}>{decodedCategory}</h1>
        <div style={{ width: '100px' }} />
      </div>
      <div className="glass-card" style={{ width: '100%', maxWidth: '720px', padding: '1rem' }}>
        <TypingTrainer words={words} speakWord={speak} />
      </div>
    </div>
  );
};
