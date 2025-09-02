// src/App.js - Stop Motion Studio Optimisé pour macOS 10.15
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Play, Pause, ArrowLeft, Eye, Plus, Trash2, Copy, 
  Edit3, Upload, Move, X, MoreVertical, FileImage 
} from 'lucide-react';

const StopMotionStudio = () => {
  // États pour la gestion des projets
  const [currentView, setCurrentView] = useState('projects');
  const [projects, setProjects] = useState(() => {
    const saved = localStorage.getItem('stopmotion-projects');
    return saved ? JSON.parse(saved) : [
      {
        id: 1,
        name: 'Mon Premier Film',
        frames: [],
        createdAt: new Date('2024-01-15').toISOString(),
        lastModified: new Date().toISOString(),
        thumbnail: null,
        fps: 12,
        duration: 0
      }
    ];
  });
  
  const [currentProject, setCurrentProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);

  // États pour l'animation
  const [frames, setFrames] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [onionSkin, setOnionSkin] = useState(0); // 0=1x, 1=3x, 2=5x
  const [onionOpacity, setOnionOpacity] = useState(0.5);
  const [fps, setFps] = useState(12);
  const [selectedFrames, setSelectedFrames] = useState([]);
  const [draggedFrame, setDraggedFrame] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const playIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sauvegarde automatique des projets
  const saveProjects = useCallback((projectsData) => {
    try {
      localStorage.setItem('stopmotion-projects', JSON.stringify(projectsData));
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  }, []);

  // Initialiser la caméra avec gestion d'erreurs
  const initCamera = useCallback(async () => {
    try {
      setCameraError(null);
      
      // Arrêter le stream précédent
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Contraintes optimisées pour macOS 10.15
      const constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: 'environment'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Attendre que la vidéo soit prête
        return new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            resolve();
          };
        });
      }
    } catch (error) {
      console.error('Erreur caméra:', error);
      setCameraError(error.message);
      
      // Messages d'erreur personnalisés
      if (error.name === 'NotAllowedError') {
        setCameraError('Accès caméra refusé. Autorisez dans les préférences du navigateur.');
      } else if (error.name === 'NotFoundError') {
        setCameraError('Aucune caméra trouvée.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Caméra déjà utilisée par une autre application.');
      }
    }
  }, []);

  // Effet pour initialiser la caméra
  useEffect(() => {
    if (currentView === 'capture') {
      initCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [currentView, initCamera]);

  // Créer un nouveau projet
  const createProject = useCallback(() => {
    if (!newProjectName.trim()) return;
    
    const newProject = {
      id: Date.now(),
      name: newProjectName,
      frames: [],
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      thumbnail: null,
      fps: 12,
      duration: 0
    };
    
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    setNewProjectName('');
    setShowNewProject(false);
  }, [newProjectName, projects, saveProjects]);

  // Ouvrir un projet
  const openProject = useCallback((project) => {
    setCurrentProject(project);
    setFrames(project.frames || []);
    setFps(project.fps || 12);
    setCurrentFrame(0);
    setSelectedFrames([]);
    setCurrentView('capture');
  }, []);

  // Sauvegarder le projet actuel
  const saveCurrentProject = useCallback(() => {
    if (!currentProject) return;
    
    const updatedProject = {
      ...currentProject,
      frames: frames,
      fps: fps,
      lastModified: new Date().toISOString(),
      duration: frames.length / fps,
      thumbnail: frames.length > 0 ? frames[0].thumbnail : null
    };

    const updatedProjects = projects.map(p => 
      p.id === currentProject.id ? updatedProject : p
    );
    
    setProjects(updatedProjects);
    setCurrentProject(updatedProject);
    saveProjects(updatedProjects);
  }, [currentProject, frames, fps, projects, saveProjects]);

  // Auto-save quand les frames changent
  useEffect(() => {
    if (currentProject && frames.length >= 0) {
      const timeoutId = setTimeout(saveCurrentProject, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [frames, fps, saveCurrentProject, currentProject]);

  // Capturer une frame avec optimisations
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    
    try {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Utiliser les dimensions réelles de la vidéo
      const videoWidth = video.videoWidth || 1280;
      const videoHeight = video.videoHeight || 720;
      
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Dessiner l'image
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      
      // Créer les données de frame avec compression optimisée
      const frameData = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        dataUrl: canvas.toDataURL('image/jpeg', 0.85), // Qualité élevée pour l'original
        thumbnail: canvas.toDataURL('image/jpeg', 0.4) // Compression pour miniature
      };
      
      setFrames(prev => [...prev, frameData]);
      setCurrentFrame(frames.length);
      
      // Feedback visuel
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: white; opacity: 0.8; pointer-events: none;
        z-index: 9999; animation: flash 0.1s ease-out;
      `;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 100);
      
    } catch (error) {
      console.error('Erreur capture:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [frames.length, isCapturing]);

  // Import d'images optimisé
  const importImages = useCallback((event) => {
    const files = Array.from(event.target.files);
    
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          // Créer une image pour redimensionner si nécessaire
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Redimensionner si trop grand (optimisation mémoire)
            const maxWidth = 1920;
            const maxHeight = 1080;
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width *= ratio;
              height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const frameData = {
              id: Date.now() + Math.random() + index,
              timestamp: new Date().toLocaleTimeString(),
              dataUrl: canvas.toDataURL('image/jpeg', 0.85),
              thumbnail: canvas.toDataURL('image/jpeg', 0.4),
              imported: true
            };
            
            setFrames(prev => [...prev, frameData]);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
    
    event.target.value = '';
  }, []);

  // Drag & Drop optimisé
  const handleDragStart = useCallback((e, index) => {
    setDraggedFrame(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    
    if (draggedFrame !== null && draggedFrame !== dropIndex) {
      const newFrames = [...frames];
      const draggedItem = newFrames.splice(draggedFrame, 1)[0];
      newFrames.splice(dropIndex, 0, draggedItem);
      setFrames(newFrames);
    }
    
    setDraggedFrame(null);
    setDragOverIndex(null);
  }, [draggedFrame, frames]);

  // Lecture des frames avec nettoyage
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      clearInterval(playIntervalRef.current);
      setIsPlaying(false);
    } else if (frames.length > 0) {
      setIsPlaying(true);
      let frameIndex = currentFrame;
      
      playIntervalRef.current = setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        setCurrentFrame(frameIndex);
      }, 1000 / fps);
    }
  }, [isPlaying, frames.length, currentFrame, fps]);

  // Gestion des frames avec optimisation mémoire
  const deleteFrame = useCallback((index) => {
    const newFrames = frames.filter((_, i) => i !== index);
    setFrames(newFrames);
    setCurrentFrame(Math.min(currentFrame, newFrames.length - 1));
  }, [frames, currentFrame]);

  const deleteSelectedFrames = useCallback(() => {
    if (selectedFrames.length > 0) {
      const newFrames = frames.filter((_, index) => !selectedFrames.includes(index));
      setFrames(newFrames);
      setSelectedFrames([]);
      setCurrentFrame(Math.min(currentFrame, newFrames.length - 1));
    }
  }, [selectedFrames, frames, currentFrame]);

  const duplicateSelectedFrames = useCallback(() => {
    if (selectedFrames.length > 0) {
      const framesToDuplicate = selectedFrames.map(index => ({
        ...frames[index],
        id: Date.now() + Math.random()
      }));
      
      setFrames(prev => [...prev, ...framesToDuplicate]);
      setSelectedFrames([]);
    }
  }, [selectedFrames, frames]);

  // Sélection multiple optimisée
  const toggleFrameSelection = useCallback((index, event) => {
    event.stopPropagation();
    
    if (event.ctrlKey || event.metaKey) {
      setSelectedFrames(prev => 
        prev.includes(index) 
          ? prev.filter(i => i !== index)
          : [...prev, index]
      );
    } else {
      setSelectedFrames([index]);
    }
  }, []);

  // Navigation
  const backToProjects = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    setCurrentView('projects');
    setCurrentProject(null);
  }, []);

  const goToTimeline = useCallback(() => {
    setCurrentView('timeline');
  }, []);

  // Gestion du slider avec magnétisme
  const handleSliderChange = useCallback((e) => {
    const newValue = parseFloat(e.target.value);
    // Effet magnétique au centre
    if (Math.abs(newValue - 0.5) < 0.05) {
      setOnionOpacity(0.5);
    } else {
      setOnionOpacity(newValue);
    }
  }, []);

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (currentView === 'capture') {
        switch(e.key) {
          case ' ': // Espace pour capturer
            e.preventDefault();
            captureFrame();
            break;
          case 'p': // P pour play/pause
            e.preventDefault();
            togglePlayback();
            break;
          case 'o': // O pour changer onion skin
            e.preventDefault();
            setOnionSkin(prev => (prev + 1) % 3);
            break;
          default:
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentView, captureFrame, togglePlayback]);

  // INTERFACE UTILISATEUR
  
  // Vue des projets
  if (currentView === 'projects') {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-900" style={{backgroundColor: '#f3f4f6', color: '#111827'}}>
        <header style={{backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '1.5rem'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{gap: '0.75rem'}}>
              <Camera size={24} style={{color: '#3b82f6'}} />
              <h1 style={{fontSize: '1.25rem', fontWeight: '600'}}>Stop Motion Studio</h1>
            </div>
            
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
              style={{backgroundColor: '#3b82f6', gap: '0.5rem'}}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#