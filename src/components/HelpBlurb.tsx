export default function HelpBlurb() {
  return (
    <details className="rounded-md border border-[#2a3f5a] bg-[#16202d] p-3 text-sm text-[#c7d5e0]">
      <summary className="cursor-pointer select-none font-semibold text-[#66c0f4]">
        Довідка: як викласти нарізку на Steam
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-xs text-[#8f98a0]">
        <p>
          1. Завантаж кожен слот на відповідну сторінку завантаження showcase у Steam. Для Artwork
          Showcase спочатку головний слот (506px), потім бічний (100px) — порядок важливий.
        </p>
        <p>
          2. Steam приймає файли не більше 5 МБ на слот. Якщо GIF не вкладається — натисни
          «Оптимізувати» у результатах, застосується найлегший варіант стиснення, який вкладеться
          у ліміт.
        </p>
        <p>
          3. Якщо фон набагато довший за висотою за один showcase, є відомий трюк через devtools:
          відкрий форму завантаження зображення на Steam, відкрий консоль розробника і виконай:
        </p>
        <pre className="overflow-x-auto rounded bg-[#0e141b] p-2 text-[11px] text-[#c7d5e0]">
          {`document.getElementsByName('image_width')[0].value = 1000;\ndocument.getElementsByName('image_height')[0].value = 1;`}
        </pre>
        <p>
          Це знімає клієнтську перевірку розмірів у формі завантаження, щоб підсунути Steam вузьке
          зображення.
        </p>
      </div>
    </details>
  );
}
