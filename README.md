# Army Rush City

Build your own city from the Stone Age to the AI Empire: it makes the army that stops the silly enemy, in 2D, 3D or FPS. A game for kids that used to live in [kids-games](https://github.com/julientru/kids-games) (`games/armycity/`) and now has its own repo.

The page is `index.html`. The game's own code is in `game/`. A few files are shared with kids-games and were copied from it: `css/style.css`, `js/i18n.js` (languages), `js/sound.js` (sounds and music), `js/config.js`, `js/accounts.js` and `js/badges.js` (player accounts, best scores and badges, in the same Supabase project as kids-games), `js/version.js` and `js/lib/three.min.js`. Wins are still sent as `army` with a `-city` level, so they keep showing in the kids-games Best scores page, and the same browser storage keys are used, so a player signed in on kids-games is signed in here too when both are served from the same site. If you change one of those shared files in kids-games, copy it here too.

The 🏠 button goes to `../kids-games/index.html`, the kids-games hub next to this game on public-pages.


## One battle, three views: 2D / 3D / FPS

Army Rush, Army Rush 3D and Army Rush FPS used to be three games; they are now one game with a **2D / 3D / FPS** switch under the top bar on the right. It changes the whole picture, the battle and the city, at any time, even in the middle of a battle, and everything goes on as it was: the wave, your army, the enemies on the field, the city.

- **2D**: the field seen from above, drawn on a canvas. Slide your finger on the field (or hold ⬅️ ➡️, or the arrow keys / A D) to move your army.
- **3D**: the same battle in 3D from behind your army (Three.js). Same controls as 2D.
- **FPS**: through your own eyes from behind the wall. Tap or drag to move the cross-hair (or use the mouse); your army shoots at it. Hold ⬅️ ➡️ (or the arrow keys, or keep your finger at a side) to turn and see your soldiers beside you. 85° wide view upright, 135° on its side. Quick knock-outs in a row make a combo.

The view picked last is kept in the browser (`localStorage`, key `army-rush-view`), and `?view=2d`, `?view=3d` or `?view=fps` in the address opens that view. If the device can't show 3D, the 3D and FPS buttons are turned off and the game stays in 2D.

The rules all run in `game/army.js`, on the same flat 480 × 640 field in every view (x across, y down the field toward you, h = height above the grass for what flies). Each view only draws the battle and turns taps into aiming: `view2d.js`, `view3d.js` and `viewfps.js`. A view is made the first time it is picked, and kept.

## How to play cards

The first time someone plays Army Rush, a few big cards explain it: the army shoots by itself, how to aim, the 2D / 3D / FPS switch, the boxes, the wall and ❤️, and the King Tank. The first time someone plays Army Rush City, a few more cards explain the city. Only the card about aiming changes with the view (sliding in 2D and 3D, the cross-hair in FPS), so switching to FPS the first time shows just that card. Someone who played before the views were one game sees the card about the switch once. Skip closes the cards, the yellow ❓ button shows them all again, and the battle waits while a card is up. What was seen is kept in the browser (`localStorage`). The code is in `game/tutorial.js`, `tutorial.css` and `tutorial-strings.js`.

## Army Rush City

Army Rush City is the full Army Rush: the same battle, plus your own city, and the city makes your army. Its sister game, the battle alone (🪖 Army Rush), stays in kids-games. `index.html` has `data-city` on its `<body>`, which turns the city on for good (`always` in `game/city.js`). Its saved battle is `army-city-save` in `localStorage`; the tutorial and the view picked are shared with Army Rush.

In Army Rush City, tap the 🏘️ button to open a map of your own city while the battle goes on. The 2D view shows it in 2D; the 3D and FPS views show it in 3D, in the same cartoon style as the 3D battle (slide sideways on the map to turn around the town). In 3D and FPS, **🔭 Explore my city** (or a tap on the map) opens the city full screen to explore it: **🦅 Fly** over it like a bird or **🚶 Walk** in the streets as the commander, among your people (you go round the houses and through the wall only at its gates). On a phone, the joystick under the left thumb moves, sliding anywhere else looks around, pinch or ➕ ➖ zoom, ⬆️ ⬇️ fly up and down. On a computer, WASD / ZQSD or the arrow keys move, drag the mouse to look, the wheel zooms, Space / Shift fly up and down, V switches Fly / Walk and Esc goes back to the city. It starts as a village with one hut and one person. Give people jobs (🌾 farmer, 👷 brick maker, ⛏️ miner, 🛒 trader, 🐄 cow herder, 🧪 scientist), build houses so more people come, and the city moves up through 20 ages as it grows: Stone Age, First Farmers, Egyptian Empire, Ancient Greece, Roman Empire, Chinese Empire, Viking Age, Middle Ages, Renaissance, Age of Explorers, Industrial Age, Railway Age, Electric Age, Age of Cars, Jet Age, Space Age, Computer Age, Internet Age, Robot Age and AI Empire.

The bigger the city, the more food each person eats. In every new age you can upgrade your houses (one more person in each, and the look of the age), labs (more ideas) and barracks (faster training) in the Build tab.

The ground and walls change with every age, each age leaves its landmark beside the road at the bottom of the map, from the Railway Age the road gets the vehicles of the age and flying machines cross the sky, and day turns to night (windows light up). The main gate leads down to the road, the only way the enemy comes in; the fields and the mine have their own gate on the left of the wall, and the pasture and the brick yard one on the right. The people are all different (men and women, many skin tones, clothes and hats), and each worker carries the tool of their job.

The battle follows your age: its waves come from your age and repeat until you reach the next one, and the AI Empire's waves keep coming until you knock out the King Tank: that wins the game. The city helps: barracks train soldiers, traders' gold buys soldiers, the lab finds the next weapon (each one only once its age is reached), towers on the wall shoot at the enemy (upgrade them in Build, but they always stay one weapon behind your army, so never the mega bomb; the enemy goes for them first, each has its own life bar, you fix them in Build and build a new one when one falls), and bricks make the wall stronger or fix it. A red bar warns you when the enemy attacks or hits your wall or towers, the enemy plants its silly flag in the middle of your town when you lose, and there are 15 calm seconds between waves. With the city on, the battle has no weapon, army or wall boxes: your city makes all that. Only a shield box comes now and then, less often on harder levels. The code is in `game/city.js`, `city.css` and `city-strings.js`; `city3d.js` only draws the same city in 3D (the city itself stays in `city.js`), and `explore.js` and `explore.css` fly and walk in it. The 2D map and the 3D map each have their own canvas, and the one for the current view shows. If the device can't show 3D, the 2D map comes back.

## Sound and music

Old strategy-game style: a war horn at every wave, a galloping battle march with war drums and brass, a calm flute and lute tune on the start screen and in the city, a fanfare when you win and a sad tune when you lose. Every weapon has its own shot sound, enemies go BOING when knocked out, boxes, walls and explosions have theirs, and the city has sounds for building, hiring, a new age, a new weapon from the lab and new soldiers. Every page opens with the sound **off** (🔇): tap the button in the top bar to turn it on (🔊) or off again. Like YouTube, sound that you turned on plays even when the phone is on silent: `js/sound.js` asks for "playback" audio (`navigator.audioSession`, Safari 16.4+) and keeps a silent `<audio>` loop going while the sound is on, because iPhones mute web page sound on silent but not media. The same button and rules work in every game with sound (Army Rush, Hong Kong Ferries, Math Rocket, Times Table Eggs, Wobbly Tower, Deep Sea Adventure, Legoworld and Copy Me). The sound stops while the page is hidden or the battle is paused.

There are no sound files: everything is played on the fly with the Web Audio API by `js/sound.js`, so nothing is copied from another game. A game calls `Sound.play("boom")` for an effect, `Sound.shot(kind)` for a weapon, `Sound.music("battle" | "town" | null)` every frame (only a change does something) and puts `Sound.button()` in its top bar. The tunes are written as notes in `js/sound.js` (`BATTLE` and `TOWN`), easy to change.

## Pause and save

During a battle, the ⏸️ button next to 🏠 (or P / Escape on a computer) pauses the battle and the city, with **▶️ Keep playing**, **🔄 Start again** and **🏠 Games**. The city view has its own ⏸️ next to ⚔️ Battle. The battle also pauses by itself when the page is hidden (the phone goes to sleep or you switch app).

While a battle is on, it is saved in the browser every second (`localStorage`, key `army-city-save`, nothing is sent anywhere): the level, the battle and the whole city. When the page opens again with a saved battle, it asks **▶️ Keep playing** or **🔄 Start again**. There is no view in the save: a saved battle comes back in the view you are in. A lost or won battle is not kept. The things flying around (shots, sparks) are not saved, so a battle comes back without them. The code is in `game/pause.js`, `pause.css` and `pause-strings.js`; `city.js` gives its city with `city.save()` and `city.load()`.


## Run locally

Serve the folder and open http://localhost:8000:

```sh
python3 -m http.server 8000
```

## Version

The version is kept in one place: `APP_VERSION` in `js/version.js` (now **1.0.0**).

## Build and publish

```sh
npm install                # once
npm run ci                 # checks that everything builds (same as the build)
npm run build-standalone   # minifies everything into ./dist
npm run publish-dist       # empties ../public-pages/docs/army-rush and copies ./dist into it
```

`npm run publish-dist` expects the public-pages repo checked out next to this one (`../public-pages`); it stops without touching anything if `./dist` has not been built or `../public-pages/docs` is missing. It deletes everything inside `docs/army-rush` first, so no old hashed file stays behind. Then commit and push public-pages yourself.

`build.mjs` minifies the page, every script and every stylesheet into `./dist`, with the same folders. Each script and stylesheet gets a hash of its content in its name and the page is rewritten to load those names, so after a new version the browser downloads exactly the files that changed. The build stops if the page loads a file that is not part of the game.
