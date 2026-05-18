'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

const WaveBounceText = ({ text, className = '' }: { text: string; className?: string }) => {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            animation: `bounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.08}s`,
          }}
        >
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  );
};

const Cube3D = () => {
  return (
    <div
      style={{
        width: '50px',
        height: '50px',
        position: 'relative',
        transformStyle: 'preserve-3d',
        animation: 'rotateCube 6s linear infinite',
        display: 'inline-block',
        marginLeft: '15px',
        marginTop: '-15px',
        verticalAlign: 'top'
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: '50px',
            height: '50px',
            transform: [
              'translateZ(25px)',
              'rotateY(180deg) translateZ(25px)',
              'rotateY(90deg) translateZ(25px)',
              'rotateY(-90deg) translateZ(25px)',
              'rotateX(90deg) translateZ(25px)',
              'rotateX(-90deg) translateZ(25px)'
            ][i],
            opacity: 0.85,
            border: '1px solid rgba(255,255,255,0.2)',
            animation: `faceColor${i} 8s linear infinite`,
            backfaceVisibility: 'hidden'
          }}
        />
      ))}
    </div>
  );
};

const HighlightWords = ({ text, wordsToHighlight = [] }: { text: string; wordsToHighlight?: string[] }) => {
  let result = text;
  wordsToHighlight.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, `<HIGHLIGHT>${word}</HIGHLIGHT>`);
  });

  return (
    <span>
      {result.split('<HIGHLIGHT>').map((part, i) => {
        if (i === 0) return part;
        const [word, ...rest] = part.split('</HIGHLIGHT>');
        return (
          <span key={i}>
            <span
              style={{
                fontWeight: 'bold',
                animation: 'colorShift 8s linear infinite',
                display: 'inline-block'
              }}
            >
              {word}
            </span>
            {rest.join('</HIGHLIGHT>')}
          </span>
        );
      })}
    </span>
  );
};

const slides = [
  {
    id: 1,
    title: 'Contraste Simultané',
    subtitle: 'Réalisé par Ahmed, Ismael, Dalil, Abdallah, Madani',
    author: '4e6 Mme. Berrached',
    type: 'title'
  },
  {
    id: 2,
    title: 'Sommaire',
    content: [
      'La définition',
      'Le principe de ce contraste',
      'Des exemples',
      'Des artistes qui l\'utilisent',
      'Une analyse',
      'Conclusion'
    ],
    author: 'Ahmed',
    type: 'toc'
  },
  {
    id: 3,
    title: 'Définition',
    boxes: [
      { color: 'bg-green-200', text: 'Le contrasté simultané, c\'est un phénomène visuel où deux couleurs placées côte à côte se modifient dans notre perception.' },
      { color: 'bg-yellow-300', text: 'En réalité, ce n\'est pas les couleurs qui changent, mais notre œil qui les voit différemment selon ce qui est autour.' },
      { color: 'bg-green-300', text: 'Chaque couleur influence l\'autre : elles peuvent paraître plus lumineuses, plus intenses ou même légèrement différentes.' }
    ],
    author: 'Isma',
    type: 'definition'
  },
  {
    id: 4,
    title: 'Le principe',
    content: [
      'Le principe du contraste simultané repose sur le fonctionnement de notre œil et de notre cerveau.',
      'Quand on regarde deux couleurs placées côte à côte, notre œil ne les voit pas séparément : il les compare automatiquement.',
      'Du coup, chaque couleur influence l\'autre et peut paraître différente de sa couleur réelle.',
      'Ce phénomène est encore plus fort avec les couleurs complémentaires.'
    ],
    author: 'Isma',
    type: 'principle'
  },
  {
    id: 5,
    title: 'Exemples',
    content: [
      'Le contraste simultané est visible dans la vie quotidienne et dans l\'art.',
      'Par exemple, le rouge et le vert paraissent plus intenses lorsqu\'ils sont côte à côte, tout comme le bleu et l\'orange qui se renforcent mutuellement.',
      'On peut aussi le voir avec le gris, qui semble plus clair sur un fond noir et plus foncé sur un fond blanc, bien qu\'il reste identique.'
    ],
    author: 'Dalil',
    type: 'examples'
  },
  {
    id: 6,
    title: 'Exemples d\'images',
    images: [
      { title: 'Terrasse du café le soir', artist: 'Van Gogh' },
      { title: 'La Gare Saint-Lazare', artist: 'Monet' }
    ],
    author: 'Madani',
    type: 'image-examples'
  },
  {
    id: 7,
    title: 'Artistes',
    content: [
      'Plusieurs artistes ont utilisé le contraste simultané pour rendre leurs œuvres plus fortes et plus expressives.',
      'Un des premiers à avoir étudié ce phénomène est Eugène Chevreul. Il n\'est pas peintre, mais ses recherches sur les couleurs ont beaucoup influencé les artistes. Il a montré que les couleurs changent selon celles qui sont à côté.',
      'Parmi les peintres, Vincent van Gogh est l\'un des plus connus. Il utilise souvent des couleurs très opposées, comme le jaune et le bleu, pour donner beaucoup d\'intensité à ses tableaux et faire ressortir les émotions.'
    ],
    author: 'Kooli',
    type: 'artists'
  },
  {
    id: 8,
    title: 'Analyse d\'un tableau de Van Gogh',
    subtitle: 'La Nuit Étoilée',
    textContent: [
      'Dans certaines œuvres de Vincent van Gogh, on voit très bien le contraste simultané.',
      'Par exemple, il associe souvent des jaunes très lumineux avec des bleus profonds. Ces couleurs sont opposées, donc elles se renforcent entre elles.',
      'Le tableau attire tout de suite l\'œil et donne une impression de mouvement et d\'énergie.',
      'Ainsi, Van Gogh utilise ce contraste pour rendre ses œuvres plus vivantes et expressives.'
    ],
    author: 'Kooli',
    type: 'analysis'
  },
  {
    id: 9,
    title: 'Conclusion',
    content: [
      'Pour conclure, le contraste simultané est un phénomène important en arts plastiques.',
      'Il montre que les couleurs ne sont pas vues de manière isolée, mais qu\'elles changent selon celles qui les entourent.',
      'Ce principe est très utilisé par les artistes pour rendre leurs œuvres plus vivantes, plus fortes et plus intéressantes à regarder.',
      'Grâce à lui, une image peut sembler plus lumineuse, plus dynamique et attirer davantage l\'attention du spectateur.',
      'C\'est donc un élément essentiel pour comprendre comment fonctionnent les couleurs dans l\'art, au moins le sommaire'
    ],
    author: 'Ahmed',
    type: 'conclusion'
  }
];

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide(currentSlide + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide(currentSlide - 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextSlide();
      if (e.key === 'ArrowLeft') handlePrevSlide();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error(err);
      }
    } else {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const slide = slides[currentSlide];

  return (
    <div
      ref={containerRef}
      className="w-full h-screen bg-gradient-to-br from-teal-50 to-teal-100 overflow-hidden flex flex-col"
    >
      {/* Slide Container */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <style jsx>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Sora:wght@300;400;600&display=swap');

          .slide-enter {
            animation: slideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          .slide-exit {
            animation: slideOut 0.3s ease-in;
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideOut {
            from {
              opacity: 1;
              transform: translateY(0);
            }
            to {
              opacity: 0;
              transform: translateY(-20px);
            }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes float {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-5px);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }

          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-8px);
            }
          }

          @keyframes rotateCube {
            0% {
              transform: rotateX(0deg) rotateY(0deg);
            }
            100% {
              transform: rotateX(360deg) rotateY(360deg);
            }
          }

          @keyframes faceColor0 {
            0% { background: #ef4444; }
            25% { background: #3b82f6; }
            50% { background: #10b981; }
            75% { background: #06b6d4; }
            100% { background: #ef4444; }
          }

          @keyframes faceColor1 {
            0% { background: #3b82f6; }
            25% { background: #10b981; }
            50% { background: #06b6d4; }
            75% { background: #ef4444; }
            100% { background: #3b82f6; }
          }

          @keyframes faceColor2 {
            0% { background: #10b981; }
            25% { background: #06b6d4; }
            50% { background: #ef4444; }
            75% { background: #3b82f6; }
            100% { background: #10b981; }
          }

          @keyframes faceColor3 {
            0% { background: #06b6d4; }
            25% { background: #ef4444; }
            50% { background: #3b82f6; }
            75% { background: #10b981; }
            100% { background: #06b6d4; }
          }

          @keyframes faceColor4 {
            0% { background: #ef4444; }
            25% { background: #3b82f6; }
            50% { background: #10b981; }
            75% { background: #06b6d4; }
            100% { background: #ef4444; }
          }

          @keyframes faceColor5 {
            0% { background: #3b82f6; }
            25% { background: #10b981; }
            50% { background: #06b6d4; }
            75% { background: #ef4444; }
            100% { background: #3b82f6; }
          }

          @keyframes colorShift {
            0% {
              color: #0d9488;
            }
            12% {
              color: #ef4444;
            }
            24% {
              color: #3b82f6;
            }
            36% {
              color: #f59e0b;
            }
            48% {
              color: #8b5cf6;
            }
            60% {
              color: #10b981;
            }
            72% {
              color: #ec4899;
            }
            85% {
              color: #f97316;
            }
            100% {
              color: #0d9488;
            }
          }

          @keyframes scalePopIn {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.15);
            }
            100% {
              transform: scale(1);
            }
          }

          @keyframes bounceColorShift {
            0% {
              transform: translateY(0);
              color: #0d9488;
            }
            14% {
              transform: translateY(-8px);
              color: #ef4444;
            }
            28% {
              transform: translateY(0);
              color: #3b82f6;
            }
            42% {
              transform: translateY(-8px);
              color: #f59e0b;
            }
            56% {
              transform: translateY(0);
              color: #8b5cf6;
            }
            70% {
              transform: translateY(-8px);
              color: #10b981;
            }
            85% {
              transform: translateY(0);
              color: #ec4899;
            }
            100% {
              transform: translateY(0);
              color: #0d9488;
            }
          }

          @keyframes wiggle {
            0%, 100% {
              transform: rotate(0deg);
            }
            25% {
              transform: rotate(-2deg);
            }
            75% {
              transform: rotate(2deg);
            }
          }

          @keyframes shimmer {
            0% {
              background-position: -1000px 0;
            }
            100% {
              background-position: 1000px 0;
            }
          }

          .bounce-text {
            animation: bounce 2s ease-in-out infinite;
            display: inline-block;
          }

          .color-shift-text {
            animation: colorShift 8s linear infinite;
            font-weight: 600;
          }

          .pop-text {
            animation: scalePopIn 2s ease-in-out infinite;
            display: inline-block;
          }

          .wiggle-text {
            animation: wiggle 1.5s ease-in-out infinite;
            display: inline-block;
          }

          .bounce-color-text {
            animation: bounceColorShift 6s ease-in-out infinite;
            display: inline-block;
          }

          .fade-in-element {
            animation: fadeInUp 0.8s ease-out forwards;
          }

          .fade-in-delay-1 {
            animation: fadeInUp 0.8s ease-out 0.1s forwards;
          }

          .fade-in-delay-2 {
            animation: fadeInUp 0.8s ease-out 0.2s forwards;
          }

          .fade-in-delay-3 {
            animation: fadeInUp 0.8s ease-out 0.3s forwards;
          }

          img {
            animation: float 4s ease-in-out infinite !important;
            transition: transform 0.3s ease;
          }

          img:hover {
            animation: float 4s ease-in-out infinite !important;
            filter: brightness(1.1);
          }

          div[class*="rounded"] > img,
          .rounded-2xl > img,
          .rounded-3xl > img,
          .rounded-xl > img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          div[class*="rounded"],
          .rounded-2xl,
          .rounded-3xl,
          .rounded-xl {
            overflow: hidden;
          }

          .pulse-element {
            animation: pulse 2.5s ease-in-out infinite;
          }

          .list-item {
            animation: fadeInUp 0.8s ease-out forwards;
            transition: all 0.3s ease;
          }

          .list-item:hover {
            transform: translateX(10px);
          }

          .title-font {
            font-family: 'Playfair Display', serif;
          }

          .body-font {
            font-family: 'Sora', sans-serif;
          }
        `}</style>

        <div
          className={`w-full h-full max-w-6xl px-8 py-12 flex items-center justify-center transition-opacity duration-300 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          } slide-enter`}
        >
          {/* Title Slide */}
          {slide.type === 'title' && (
            <div className="w-full text-center space-y-12">
              <div className="space-y-4">
                <h1 className="title-font text-7xl md:text-8xl font-black text-teal-800 leading-tight color-shift-text">
                  {slide.title}
                </h1>
                <h2 className="title-font text-3xl md:text-4xl text-teal-600 font-light tracking-wide">
                  {slide.subtitle}
                </h2>
              </div>
              <div className="space-y-2 text-teal-700">
                <p className="body-font text-xl font-light">{slide.author}</p>
              </div>
              <div className="flex gap-4 justify-center pt-8">
                <div className="w-16 h-1 bg-teal-400 rounded-full pulse-element"></div>
                <div className="w-16 h-1 bg-amber-300 rounded-full pulse-element" style={{animationDelay: '0.3s'}}></div>
                <div className="w-16 h-1 bg-teal-300 rounded-full pulse-element" style={{animationDelay: '0.6s'}}></div>
              </div>
            </div>
          )}

          {/* Table of Contents */}
          {slide.type === 'toc' && (
            <div className="w-full grid grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <h1 className="title-font text-6xl font-bold text-teal-700 bounce-text">{slide.title}</h1>
                <ul className="space-y-6">
                  {slide.content?.map((item, i) => (
                    <li
                      key={i}
                      className="body-font text-2xl text-teal-800 font-light flex items-center gap-4 list-item"
                      style={{animation: `fadeInUp 0.8s ease-out ${0.1 + i * 0.1}s forwards`}}
                    >
                      <span className="w-3 h-3 bg-teal-500 rounded-full pulse-element" style={{animationDelay: '0.2s'}}></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <img src="/images/poppy-field.png" alt="Color Contrast Example" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          {/* Definition Slide */}
          {slide.type === 'definition' && (
            <div className="w-full space-y-12">
              <div className="flex items-center">
                <h1 className="title-font text-6xl font-bold text-teal-800 mb-8 color-shift-text">{slide.title}</h1>
                <Cube3D />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                <div className="space-y-6">
                  {slide.boxes?.map((box, i) => (
                    <div
                      key={i}
                      className={`${box.color} rounded-3xl p-8 body-font text-base text-gray-800 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300`}
                      style={{
                        animationDelay: `${i * 0.15}s`,
                        animation: 'fadeInUp 0.7s ease-out forwards',
                        opacity: 0
                      }}
                    >
                      <p className="font-light leading-relaxed">
                        <HighlightWords text={box.text} wordsToHighlight={['couleurs', 'phénomène']} />
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl overflow-hidden shadow-2xl">
                  <img src="/images/haystacks.png" alt="Monet's Haystacks - Color Variation" className="w-full h-auto object-cover" />
                  <p className="bg-teal-50 body-font text-sm text-teal-700 p-3 font-light text-center">Les Meules de Giverny</p>
                </div>
              </div>
              <p className="text-right text-teal-700 font-light text-sm mt-8">{slide.author}</p>
            </div>
          )}

          {/* Principle Slide */}
          {slide.type === 'principle' && (
            <div className="w-full h-full flex flex-col overflow-y-auto">
              <h1 className="title-font text-5xl font-bold text-teal-800 mb-8 flex-shrink-0">
                <WaveBounceText text={slide.title} />
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                <div className="space-y-4 overflow-y-auto pr-4">
                  {slide.content?.map((para, i) => (
                    <p
                      key={i}
                      className="body-font text-base text-teal-900 font-light leading-relaxed"
                    >
                      <HighlightWords text={para} wordsToHighlight={['contraste', 'comparer']} />
                    </p>
                  ))}
                </div>
                <div className="space-y-4 flex flex-col justify-center items-center">
                  <div className="rounded-xl overflow-hidden shadow-lg flex-shrink-0 h-48 w-full">
                    <img src="/images/cafe-terrace.png" alt="Café Terrace" className="w-full h-full object-cover" />
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-lg flex-shrink-0 h-48 w-full">
                    <img src="/images/haystacks.png" alt="Haystacks" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
              <p className="text-right text-teal-700 font-light text-xs mt-6 flex-shrink-0">{slide.author}</p>
            </div>
          )}

          {/* Examples Slide */}
          {slide.type === 'examples' && (
            <div className="w-full space-y-12">
              <h1 className="title-font text-6xl font-bold text-teal-800">
                <WaveBounceText text={slide.title} />
              </h1>
              <div className="space-y-6 mb-8">
                {slide.content?.map((para, i) => (
                  <p
                    key={i}
                    className="body-font text-lg text-teal-900 font-light leading-relaxed"
                  >
                    <HighlightWords text={para} wordsToHighlight={['couleurs', 'intensité']} />
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
                <div className="rounded-xl overflow-hidden shadow-lg">
                  <img src="/images/rouen-cathedral.png" alt="Rouen" className="w-full h-48 object-cover" />
                </div>
                <div className="rounded-xl overflow-hidden shadow-lg">
                  <img src="/images/gare-saint-lazare.png" alt="Gare" className="w-full h-48 object-cover" />
                </div>
                <div className="rounded-xl overflow-hidden shadow-lg">
                  <img src="/images/cafe-terrace.png" alt="Café" className="w-full h-48 object-cover" />
                </div>
              </div>
              <p className="text-right text-teal-700 font-light text-sm">{slide.author}</p>
            </div>
          )}

          {/* Image Examples Slide */}
          {slide.type === 'image-examples' && (
            <div className="w-full h-full flex flex-col justify-center">
              <h1 className="title-font text-6xl font-bold text-teal-800 mb-12">
                <WaveBounceText text={slide.title} />
              </h1>
              <div className="grid grid-cols-2 gap-16 max-w-4xl mx-auto">
                <div className="space-y-4 flex flex-col items-center">
                  <div className="rounded-2xl overflow-hidden shadow-2xl w-96 h-64">
                    <img
                      src="/images/poppy-field.png"
                      alt="Poppy Field"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="title-font text-xl font-bold text-teal-800 text-center">Champ de coquelicots</h3>
                  <p className="body-font text-sm text-teal-700 font-light">Claude Monet</p>
                </div>
                <div className="space-y-4 flex flex-col items-center">
                  <div className="rounded-2xl overflow-hidden shadow-2xl w-96 h-64">
                    <img
                      src="/images/gare-saint-lazare.png"
                      alt="La Gare Saint-Lazare"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="title-font text-xl font-bold text-teal-800 text-center">La Gare Saint-Lazare</h3>
                  <p className="body-font text-sm text-teal-700 font-light">Claude Monet</p>
                </div>
              </div>
              <p className="text-right text-teal-700 font-light text-sm mt-12">{slide.author}</p>
            </div>
          )}

          {/* Artists Slide */}
          {slide.type === 'artists' && (
            <div className="w-full space-y-12">
              <h1 className="title-font text-6xl font-bold text-teal-800">
                <WaveBounceText text={slide.title} />
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-2 space-y-4">
                  {slide.content?.map((para, i) => (
                    <p
                      key={i}
                      className="body-font text-base text-teal-900 font-light leading-relaxed"
                    >
                      <HighlightWords text={para} wordsToHighlight={['couleurs', 'opposées']} />
                    </p>
                  ))}
                </div>
                <div className="space-y-4 flex flex-col justify-end">
                  <div className="rounded-2xl overflow-hidden shadow-2xl h-48">
                    <img
                      src="/images/vincent-vangog.png"
                      alt="Vincent van Gogh"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="body-font text-sm text-teal-600 font-light text-center">Vincent van Gogh</p>
                  <div className="rounded-2xl overflow-hidden shadow-2xl h-48">
                    <img
                      src="/images/starry-night.png"
                      alt="Starry Night"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="body-font text-xs text-teal-600 font-light text-center">His Work</p>
                </div>
              </div>
              <p className="text-right text-teal-700 font-light text-sm">{slide.author}</p>
            </div>
          )}

          {/* Analysis Slide */}
          {slide.type === 'analysis' && (
            <div className="w-full space-y-12">
              <div className="space-y-3 mb-8">
                <h1 className="title-font text-6xl font-bold text-teal-800 color-shift-text">{slide.title}</h1>
                <h2 className="title-font text-4xl font-light text-teal-600">{slide.subtitle}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
                <div className="space-y-6">
                  {slide.textContent?.map((para, i) => (
                    <p
                      key={i}
                      className="body-font text-lg text-teal-900 font-light leading-relaxed"
                    >
                      <HighlightWords text={para} wordsToHighlight={['contraste', 'luminosité']} />
                    </p>
                  ))}
                </div>
                <div className="rounded-2xl overflow-hidden shadow-2xl">
                  <img src="/images/starry-night.png" alt="La Nuit Étoilée" className="w-full h-auto object-cover" />
                </div>
              </div>
              <p className="text-right text-teal-700 font-light text-sm mt-12">{slide.author}</p>
            </div>
          )}

          {/* Conclusion Slide */}
          {slide.type === 'conclusion' && (
            <div className="w-full space-y-12">
              <h1 className="title-font text-6xl font-bold text-teal-700">
                <WaveBounceText text={slide.title} />
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
                <div className="space-y-4">
                  {slide.content?.map((para, i) => (
                    <p
                      key={i}
                      className="body-font text-lg text-teal-900 font-light leading-relaxed"
                    >
                      <HighlightWords text={para} wordsToHighlight={['couleurs', 'contraste']} />
                    </p>
                  ))}
                </div>
                <div className="rounded-2xl overflow-hidden shadow-2xl">
                  <img
                    src="/images/poppy-field.png"
                    alt="Poppy Field"
                    className="w-full aspect-square object-cover"
                  />
                </div>
              </div>
              <p className="text-right text-teal-700 font-light text-sm">{slide.author}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="bg-white/50 backdrop-blur-md border-t border-teal-200 px-8 py-6 flex items-center justify-between">
        <button
          onClick={handlePrevSlide}
          disabled={currentSlide === 0}
          className="p-3 rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i === currentSlide
                    ? 'bg-teal-600 w-8'
                    : 'bg-teal-300 hover:bg-teal-400'
                }`}
              />
            ))}
          </div>
          <span className="body-font text-sm text-teal-700 font-light ml-4">
            {currentSlide + 1} / {slides.length}
          </span>
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-all duration-200 hover:shadow-lg"
        >
          {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
        </button>

        <button
          onClick={handleNextSlide}
          disabled={currentSlide === slides.length - 1}
          className="p-3 rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Keyboard Help */}
      <div className="bg-teal-50 px-8 py-2 text-center body-font text-xs text-teal-600 font-light">
        ← → Arrow keys | F Fullscreen | Click dots to navigate
      </div>
    </div>
  );
}
