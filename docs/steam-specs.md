# Steam showcase specs (researched 2026-11-14)

Числа зібрані з community-джерел; позначки CONFLICTING/UNCONFIRMED — див. нижче.

## Showcase layouts

| Showcase | Slots | Slot width (px) | Height | Gap |
|---|---|---|---|---|
| Featured Artwork | 1 | 630 | будь-яка | — |
| Artwork Showcase | 2 (main + side) | 506 + 100 | будь-яка, однакова | ~8px (CONFLICTING: 8 vs 9, після UI-апдейтів плавав до 12) |
| Screenshot Showcase | 4 (1 main + 3 side) | 506 main | — | UNCONFIRMED |
| Workshop Showcase | 5 | upload 150×150, render ~119–122 | fixed | ~4px |

- Upload НЕ даунскейлиться: рекомендовано вантажити 2x (1260 / 1012+200) для чіткості на HiDPI.
- Ліміт файлу: **5MB** на файл (уніфіковано JPG/PNG/GIF; було 8MB до ~грудня 2022).
- Анімовані GIF працюють в Artwork/Featured без трюків (2025/2026). Якщо >5MB — Steam показує статичний кадр.
- Трюк довгого зображення (висота > звичайної) через devtools:
  `document.getElementsByName('image_width')[0].value = 1000;`
  `document.getElementsByName('image_height')[0].value = 1;`

## Профільний фон (Points Shop)

| Asset | Розмір | Формат | Ліміт |
|---|---|---|---|
| Static background | 1920×1080 | JPG | <350KB |
| Animated background | 1920×1080 | mp4/webm | <4MB |
| Mini-profile bg | 640×570 | mp4/webm | <4MB |

Анімовані фони Steam — це mp4/webm, НЕ gif. Для нарізки у вітрину джерелом беремо
відео/гіф/картинку користувача і ріжемо на GIF-и під слоти.

## GIF оптимізація (ціль <5MB)

- gifsicle: `-O2/-O3` + `--lossy=30..60` (баланс), до 200 (агресивно).
- Зниження fps драбинкою: 60→48→30→24→20→15→12→10.
- Зниження палітри: 256→...→8 кольорів (`--colors N`).
- Остання міра — зменшення роздільної здатності.
- Пріоритет community-тулів: тримати fps, різати кольори.

## Що треба перевірити емпірично

- Точний gap Artwork Showcase (8 чи 9px) — завантажити тест-сітку на реальний профіль.
- Розміри side-слотів Screenshot Showcase.
