/**
 * PokemonPage.tsx — entry point. Mount it on your /pokemon route:
 *
 *   import PokemonPage from "./pokemon/PokemonPage";
 *   <Route path="/pokemon" element={<PokemonPage />} />
 *
 * The game is responsive: it always fills the whole viewport at any aspect
 * ratio (see hooks/useScale.ts). Touch controls are drawn over the overworld
 * and hidden during battles, where the menu is clickable instead.
 * Start / MENU opens the team and bag menu while walking; A talks to people
 * (walk into a HEAL CENTER and talk to the nurse over the counter to heal).
 *
 * Folder layout
 *   pokemon.css                 all styles
 *   types.ts / constants.ts / utils.ts / player.ts
 *   monsters.ts                 stats, experience, damage, encounters, catching
 *   items.ts                    items, starting inventory, team size
 *   save.ts                     localStorage save / load
 *   sprites.ts                  optional custom sprites (public/pokemon/*.png)
 *   data/species.ts             creatures: types, stats and learnsets
 *   data/types.ts               type chart, per-type effects, statuses
 *   data/moves.ts               move catalog (type, power, accuracy, effect)
 *   fx/                         attack animations: recipes.ts (one per move), motions.ts, types.ts
 *   maps/data.ts                ASCII maps (towns, routes, interiors), warps, NPCs, gym leader
 *   maps/index.ts               map helpers (solid tiles, warps...)
 *   hooks/useGame.ts            game rules and state (maps, team, battles, saving)
 *   hooks/useGameInput.ts       keyboard + on-screen button bus
 *   hooks/useScale.ts           responsive screen size
 *   hooks/useSprites.ts         sprite loading
 *   components/                 TitleScreen, DialogBox, MapBanner, StatusBadge, ...
 *   components/overworld/       Overworld canvas, tile and sprite drawing
 *   components/evolution/       Evolution cutscene (3D scene + dust and light effects)
 *   components/battle/          Battle HUD + 3D scene, creatures, camera, MoveFx (attack visual effects)
 *
 * Keyboard: arrows/WASD move · Z/Space = A · X/Backspace = B · Enter = Start
 * (Esc is taken by the arcade room, see src/arcade)
 */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import "./pokemon.css";
import { useGame } from "./hooks/useGame";
import { useGameInput } from "./hooks/useGameInput";
import { useScale } from "./hooks/useScale";
import { mapMusic, Music, useGameMusic } from "./hooks/useGameMusic";
import { SpeakerIcon, useMuteButton } from "../../components/MuteButton";
import { Battle } from "./components/battle/Battle";
import { DialogBox } from "./components/DialogBox";
import { Evolution } from "./components/evolution/Evolution";
import { GamepadControls } from "./components/GamepadControls";
import { HealAnimation } from "./components/HealAnimation";
import { MapBanner } from "./components/MapBanner";
import { PauseMenu } from "./components/PauseMenu";
import { Overworld } from "./components/overworld/Overworld";
import { PaletteFilter } from "./components/PaletteFilter";
import { StatusBadge } from "./components/StatusBadge";
import { TitleScreen } from "./components/TitleScreen";

export default function PokemonPage() {
  const { scale, width, height } = useScale();
  const { held, press, release, subscribe } = useGameInput();
  const g = useGame(held, subscribe);

  const screenStyle = {
    width: width * scale,
    height: height * scale,
    "--u": `${scale}px`,
  } as CSSProperties;

  // the healing jingle plays once, from the moment the team is handed over until it ends
  const [jingle, setJingle] = useState(false);
  useEffect(() => {
    if (g.healing) setJingle(true);
  }, [g.healing]);

  // what's playing, from the most to the least important (nothing on the title screen)
  const inBattle = g.mode === "battle" || g.mode === "transition";
  const trainerBattle = !!g.battle?.trainer;
  const music: Music | undefined = jingle
    ? { file: "pokemon_healed.mp3", once: true }
    : g.victory
    ? { file: g.victory === "trainer" ? "trainer_victory.mp3" : "wild_victory.mp3" }
    : inBattle
    ? { file: trainerBattle ? "trainer_battle.mp3" : "wild_battle.mp3" }
    : g.trainerSpotted
    ? { file: "trainer_sees_player.mp3" }
    : g.mode !== "title"
    ? mapMusic(g.mapId)
    : undefined;
  useGameMusic(music, () => setJingle(false));

  const mute = useMuteButton();

  const lead = g.team[0];
  const showControls = (g.mode === "title" || g.mode === "overworld") && !g.dialog && !g.healing && !g.cutscene;

  return (
    <div className="gb-page">
      <PaletteFilter />

      <div className="gb-screen" style={screenStyle}>
        <button className="gb-pad-btn gb-sound" {...mute.props}>
          <SpeakerIcon muted={mute.muted} />
        </button>
        {g.mode !== "battle" && (
          <Overworld
            active={g.active}
            animating={g.animating}
            walkers={g.walkers}
            viewW={width}
            viewH={height}
            map={g.map}
            player={g.player}
            held={held}
            onStepEnd={g.handleStep}
          />
        )}

        {g.mode === "title" && (
          <TitleScreen
            hasSave={g.hasSave}
            subscribe={subscribe}
            onNew={g.startNew}
            onContinue={g.continueGame}
          />
        )}

        {g.mode === "overworld" && !g.dialog && !g.healing && (
          <StatusBadge member={lead} badges={g.badges.length} />
        )}
        {g.mode === "overworld" && g.banner && (
          <MapBanner key={g.banner.key} text={g.banner.text} onDone={g.clearBanner} />
        )}
        {g.fadeKey > 0 && g.mode !== "battle" && <div key={g.fadeKey} className="gb-fade" />}
        {g.mode === "transition" && <div className="gb-flash" />}

        {g.mode === "battle" && g.battle && (
          <Battle
            key={g.battleId}
            team={g.team}
            inventory={g.inventory}
            enemy={g.battle.enemy}
            trainer={g.battle.trainer}
            scale={scale}
            subscribe={subscribe}
            onFinish={g.finishBattle}
            onVictory={g.winBattle}
          />
        )}

        {g.dialog && (
          <DialogBox
            text={g.dialog.lines[g.dialog.index]}
            subscribe={subscribe}
            onNext={g.advanceDialog}
            choices={
              g.dialog.index === g.dialog.lines.length - 1
                ? g.dialog.choices?.map((c) => c.label)
                : undefined
            }
            onChoose={g.chooseDialog}
          />
        )}

        {g.healing && <HealAnimation count={g.team.length} />}

        {g.mode === "evolution" && g.evolution && g.team[g.evolution.index] && (
          <Evolution
            key={`${g.evolution.index}-${g.evolution.toId}`}
            member={g.team[g.evolution.index]}
            toId={g.evolution.toId}
            scale={scale}
            subscribe={subscribe}
            onFinish={g.finishEvolution}
          />
        )}

        {g.mode === "menu" && (
          <PauseMenu
            team={g.team}
            inventory={g.inventory}
            subscribe={subscribe}
            onClose={g.closeMenu}
            onSwap={g.swapTeam}
            onUsePotion={g.healWithPotion}
          />
        )}

        {/* Touch controls: title + overworld only, never during battles or dialogs */}
        {showControls && (
          <GamepadControls
            press={press}
            release={release}
            startLabel={g.mode === "title" ? "START" : "MENU"}
          />
        )}
      </div>
    </div>
  );
}