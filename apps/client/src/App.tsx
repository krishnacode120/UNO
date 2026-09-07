import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Gamepad2, Music2, Settings2, Trophy, Users, Volume2, VolumeX } from 'lucide-react';
import { GameBoard } from './components/GameBoard.js';
import { HelpView } from './components/HelpView.js';
import { HomeScreen } from './components/HomeScreen.js';
import { LobbyView } from './components/LobbyView.js';
import { SettingsView } from './components/SettingsView.js';
import { StatsView } from './components/StatsView.js';
import { Avatar } from './components/PlayerBadge.js';
import { useAudio } from './hooks/useAudio.js';
import { useMultiplayer } from './hooks/useMultiplayer.js';
import { usePersistentProfile } from './hooks/usePersistentProfile.js';
import { useSinglePlayerGame } from './hooks/useSinglePlayerGame.js';
import { soundForEvent } from './lib/events.js';

type Screen = 'home' | 'single' | 'multiplayer' | 'settings' | 'statistics' | 'help';
const inviteCode = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
export const App = () => {
  const [screen, setScreen] = useState<Screen>(() => {
    try { return inviteCode || sessionStorage.getItem('uno-arena:reconnect') ? 'multiplayer' : 'home'; }
    catch { return 'home'; }
  });
  const { profile, updateSettings, recordGame, renameProfile, saveError } = usePersistentProfile();
  const [muted, setMuted] = useState(false);
  const { play, musicEnabled, toggleMusic } = useAudio(muted ? 0 : profile.settings.soundVolume, muted ? 0 : profile.settings.musicVolume);
  const solo = useSinglePlayerGame(profile.settings, profile, screen === 'single');
  const multi = useMultiplayer(profile.name, profile.settings);
  const game = screen === 'single' ? solo.game : multi.room?.game;
  const inGame = (screen === 'single' || screen === 'multiplayer') && !!game;
  const lastEvent = useRef('');
  useEffect(() => {
    if (!game) return;
    const last = game.actionLog.at(-1);
    if (!last || last.id === lastEvent.current) return;
    lastEvent.current = last.id;
    const sound = soundForEvent(last.type);
    if (sound) play(sound);
  }, [game, play]);
  useEffect(() => { if (solo.game) recordGame(solo.game, profile.id); }, [solo.game, recordGame, profile.id]);
  useEffect(() => { if (multi.room?.game && multi.playerId) recordGame(multi.room.game, multi.playerId); }, [multi.room?.game, multi.playerId, recordGame]);
  const nav = (next: Screen) => { play('button'); setScreen(next); };
  const startSolo = () => { play('shuffle'); if (!solo.game || solo.game.status === 'finished') solo.start(); else solo.resume(); setScreen('single'); };
  const goHome = () => { solo.leave(); setScreen('home'); };
  const leaveRoom = async () => { if (await multi.leave()) { window.history.replaceState({}, '', window.location.pathname); setScreen('home'); } };
  const navItems = [
    { id: 'home', label: 'Play', icon: Gamepad2 },
    { id: 'multiplayer', label: 'With friends', icon: Users },
    { id: 'statistics', label: 'Statistics', icon: Trophy },
    { id: 'settings', label: 'Settings', icon: Settings2 },
    { id: 'help', label: 'How to play', icon: CircleHelp }
  ] as const;
  return <MotionConfig reducedMotion={profile.settings.reducedMotion ? 'always' : 'user'}><div className={`app-root theme-${profile.settings.theme} ${profile.settings.highContrast ? 'high-contrast' : ''} ${profile.settings.reducedMotion ? 'reduced-motion' : ''} ${inGame ? 'in-game' : ''}`}>
    <aside className="sidebar"><button className="brand" aria-label="UNO Arena home" onClick={() => !inGame && nav('home')}><span className="brand-icon"><i/><i/><i/></span><span>UNO<span>ARENA</span></span></button>
      <div className="sidebar-label">LET'S PLAY</div><nav aria-label="Main navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} disabled={inGame} className={screen === id || id === 'home' && screen === 'single' ? 'selected' : ''} onClick={() => nav(id)}><Icon size={20}/><span>{label}</span>{id === 'multiplayer' && multi.room && <i className="status-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="audio-controls"><button className={musicEnabled ? 'icon-button enabled' : 'icon-button'} title={musicEnabled ? 'Pause music' : 'Play music'} aria-label={musicEnabled ? 'Pause music' : 'Play music'} onClick={toggleMusic}><Music2 size={18}/></button><button className="icon-button" title={muted ? 'Unmute sounds' : 'Mute sounds'} aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button></div><div className="sidebar-profile"><Avatar name={profile.name}/><div><strong>{profile.name || 'Player'}</strong><small>Always up for a game</small></div></div></div>
    </aside>
    <div className="workspace"><header className="app-topbar"><span className="breadcrumb">THE ARENA<span>/</span>{inGame ? 'At the table' : navItems.find((item) => item.id === screen)?.label}</span><div className="topbar-right"><span className="small-label"><span className={`status-dot ${multi.connected ? '' : 'offline'}`}/>{multi.connected ? 'Connected' : 'Solo available'}</span><Avatar name={profile.name}/></div></header>
    {saveError && <div className="error-banner" role="alert">Device storage is full. Your latest results could not be saved.</div>}
    <AnimatePresence mode="wait" initial={false}><motion.div className="page" key={screen} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
      {screen === 'home' && <HomeScreen playerName={profile.name} statistics={profile.statistics} hasSavedGame={!!solo.game && solo.game.status === 'playing'} onPlay={startSolo} onCreate={() => { nav('multiplayer'); if (!multi.room) void multi.createRoom(); }} onJoin={() => nav('multiplayer')}/>}
      {screen === 'single' && solo.game && <GameBoard game={solo.game} viewerId={profile.id} onAction={solo.dispatch} error={solo.error} onLeave={goHome} onRematch={solo.start} muted={muted} onMute={() => setMuted(!muted)}/>}
      {screen === 'multiplayer' && (multi.room?.game && multi.playerId ? <GameBoard game={multi.room.game} viewerId={multi.playerId} roomCode={multi.room.code} connected={multi.connected} busy={multi.busy} error={multi.error} onAction={(action) => void multi.sendAction(action)} onLeave={() => void leaveRoom()} onRematch={multi.isHost ? () => void multi.startGame() : undefined} muted={muted} onMute={() => setMuted(!muted)}/> : <LobbyView room={multi.room} playerId={multi.playerId} connected={multi.connected} busy={multi.busy} error={multi.error} isHost={multi.isHost} initialCode={inviteCode} onCreate={() => void multi.createRoom()} onJoin={(code) => void multi.joinRoom(code)} onAddBot={(difficulty) => void multi.addBot(difficulty)} onRemoveBot={(id) => void multi.removeBot(id)} onStart={() => void multi.startGame()} onBack={() => multi.room ? void leaveRoom() : nav('home')}/>)}
      {screen === 'settings' && <SettingsView settings={profile.settings} onChange={updateSettings} playerName={profile.name} onRename={renameProfile} musicEnabled={musicEnabled} onToggleMusic={toggleMusic}/>}
      {screen === 'statistics' && <StatsView statistics={profile.statistics} history={profile.matchHistory} onBack={() => nav('home')}/>}
      {screen === 'help' && <HelpView onBack={() => nav('home')}/>}
    </motion.div></AnimatePresence>
    {!inGame && <footer className="app-footer"><span>UNO ARENA</span><span>A little luck. A lot of rivalry.</span><span>Unofficial fan game</span></footer>}
    </div></div></MotionConfig>;
};
