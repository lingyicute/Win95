# Fonts bundled with this desktop

The shell draws its own text with faces that ship inside this repository, so
the interface looks the same on every machine. Only the places that show text
you type yourself fall back to whatever fonts the system offers: the Notepad
and Clipboard Viewer text areas, the command prompt, WordPad (its page, its
ruler and its font list), the Character Map, and Paint's text tool. The Fonts
control panel lists system fonts on purpose — it is a system-font preview.

All typefaces below are free / open-source. Their licences travel with the
repository; running or forking this desktop does not change the rights of the
original designers.

## Summary

| File shipped in this repo | Family name in CSS | What it is | Copyright & licence |
| --- | --- | --- | --- |
| `w95fa.woff2` | `W95FA` | Original face — a scalable re-creation of the proportional raster *MS Sans Serif* from Windows 95 | © 2019 **Alina Sava**, published by **FontsArena** — **SIL Open Font License 1.1** ([§ 1](#1-w95fa--sil-open-font-license-11)) |
| `roboto-regular-ascii.woff2` | `Roboto` | ASCII-only subset for UI chrome | © 2011 **Christian Robertson / Google** — **Apache License 2.0** ([§ 2](#2-roboto--apache-license-20)) |
| `wqy-song.woff2` | `WenQuanYi Bitmap Song 12px` | 12 px bitmap Song (Ming) for CJK, converted to woff2 | © 2004–2010 **WenQuanYi Project Board of Trustees and Qianqian Fang** — **GPL-2.0 with Font Embedding Exception** ([§ 3](#3-wenquanyi-bitmap-song--gpl-20-with-font-embedding-exception)) |
| `w95-symbols.woff2` | `W95 Symbols` | Tiny symbol supplement, subset of *DejaVu Sans* | © 2003 **Bitstream, Inc.**, DejaVu changes in public domain — **Bitstream Vera licence** ([§ 5](#5-dejavu-sans--dejavu-sans-mono-subsets--bitstream-vera-licence)) |
| `w95-symbols-tech.woff2` | `W95 Symbols` (U+2315 only) | Single glyph ⌕ supplement, subset of *DejaVu Sans Mono* | Same as above |
| `w95-serif.woff2` | `W95 Serif` | Serif UI face, subset of *Liberation Serif* | © 2010 **Google Corporation** / 2012 **Red Hat, Inc.** — **SIL Open Font License 1.1** ([§ 4](#4-liberation-serif--liberation-mono-subsets--sil-open-font-license-11)) |
| `w95-mono.woff2` | `W95 Mono` | Monospace UI face, subset of *Liberation Mono* | Same as above |

> **Subset & rename note.** `tools/font-glyphs.py` rebuilds the coverage manifest
> that the tests read, and its docstring records how each subset was cut.
> Liberation and DejaVu reserve their font names (RFN), so every subset is
> **renamed inside the font file** before it ships (`W95 Serif`, `W95 Mono`,
> `W95 Symbols`). No modified subset is distributed under a reserved name.

Source URLs retained for audit:

* W95FA: <https://fontsarena.com/w95fa-by-alina-sava/> — download bundle contains `W95FA.otf` (v1.002; Fontself Maker 3.4.0, Manufacturer *Alina Sava*, Designer *FontsArena.com*) + `OFL.txt`
* Roboto: <https://github.com/googlefonts/roboto> / <https://fonts.google.com/specimen/Roboto>
* WenQuanYi Bitmap Song: <http://wenq.org/> / <https://github.com/AmusementClub/WenQuanYi-Bitmap-Song-TTF>
* Liberation: <https://github.com/liberationfonts/liberation-fonts>
* DejaVu: <https://dejavu-fonts.github.io/>

---

## 1. W95FA — SIL Open Font License 1.1

**W95FA is by Alina Sava, published by FontsArena under the SIL Open Font License.**

* Designer: **Alina Sava**
* Publisher / Foundry: **FontsArena** — <https://fontsarena.com/w95fa-by-alina-sava/> / <https://fontsarena.com/created-by/alina-sava/>
* Created for the [W95 WordPress theme](https://brutalistthemes.com/downloads/w95/) (a Windows 95-style blog theme), 2019–2020
* What it is: a proper scalable `.otf`/`.woff2` re-creation of the proportional bitmap *MS Sans Serif* that shipped with Windows 95 — pixel style preserved, Latin Extended coverage
* File in this repo: `w95fa.woff2` (converted from the upstream `W95FA.otf` 1.002 for the web shell)
* Licence: **SIL Open Font License, Version 1.1 (26 February 2007)**
* Metadata inside the font:

  ```
  Family: W95FA
  Version: Version 1.002;Fontself Maker 3.4.0
  Manufacturer: Alina Sava
  Designer: FontsArena.com
  Vendor URL: https://fontsarena.com
  License: SIL OpenFont License — http://scripts.sil.org/OFL
  ```

* Copyright as expressed by the foundry / font metadata: **Copyright (c) 2019 Alina Sava.** The upstream OFL.txt ships as a template; the copyright holder is identified by the distribution page and the name-table fields above.

You may use, study, modify, embed and redistribute W95FA freely, including for
commercial purposes, as long as you keep the copyright + licence notices and do
not sell the font by itself. Modified versions must stay under the same licence
and must not use a Reserved Font Name without permission. See the full OFL text
below (§ 4) — it is the same document that ships in the original W95FA.zip.

> FontsArena summary: <https://fontsarena.com/licenses-explained/#ofl> ·
> OFL official text & FAQ: <https://scripts.sil.org/OFL>

---

## 2. Roboto — Apache License 2.0

* Designer: **Christian Robertson**
* Commissioned by **Google** (2011), for Android / Material Design
* File in this repo: `roboto-regular-ascii.woff2` — ASCII-only `Roboto Regular` (400) converted to woff2 for small download size. Full family at <https://fonts.google.com/specimen/Roboto>
* Licence: **Apache License, Version 2.0, January 2004** — <http://www.apache.org/licenses/LICENSE-2.0>
* Copyright notice to retain:

  ```
  Copyright 2011 Google Inc.
  Copyright 2011 Christian Robertson
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0
  ```

Apache 2.0 is permissive: you may use, modify, distribute and sell copies,
including as webfont / app-embedded font, provided you keep the copyright and
licence notices, state significant changes, and do not use the contributors'
trademarks to endorse derivatives. The full licence text is not reproduced here
for length — see the link above. A copy is also included in the original Roboto
release at `LICENSE` / `AUTHORS.txt`.

---

## 3. WenQuanYi Bitmap Song — GPL-2.0 with Font Embedding Exception

* Project: **WenQuanYi (文泉驿)** — <http://wenq.org/> — open-source CJK bitmap fonts
* Font Name: **WenQuanYi Bitmap Song** (文泉驿点阵宋体)
* Version in this repo: derived from upstream **12 px** strike, converted to `wqy-song.woff2` (covers GB18030 / CJK Unified Ideographics — 9–12 px bitmap strikes, 11–16 px in later releases)
* Developer: **The WenQuanYi Project Contributors**
* Webpage: <http://wqy.sourceforge.net/en/>
* Copyright:

  ```
  Copyright (C) 2004-2010, The WenQuanYi Project Board of Trustees
                 and Qianqian Fang
  License: GPL v2 (with font embedding exception)
  ```

* Licence: **GNU General Public License version 2**, with the standard
  **Font Embedding Exception** added by WenQuanYi:

> As a special exception, if you create a document which uses this font, and
> embed this font or unaltered portions of this font into the document, this
> font does not by itself cause the resulting document to be covered by the
> GNU General Public License. This exception does not however invalidate any
> other reasons why the document might be covered by the GNU General Public
> License. If you modify this font, you may extend this exception to your
> version of the font, but you are not obligated to do so. If you do not wish
> to do so, delete this exception statement from your version.

In practice: you may copy, distribute and modify the font as long as you pass
the same freedoms on. Embedding the *unaltered* font in a document (PDF, web
page, canvas export) does **not** make that document GPL-covered because of the
exception. Modified versions of the font itself remain GPL-2.0 (+ optional
exception).

* Licence references: GPL-2.0 text at <http://www.gnu.org/copyleft/gpl.html> and
  <https://www.gnu.org/licenses/gpl-2.0.html>; WenQuanYi README mirrors the
  notice above — see Gentoo `media-fonts/wqy-bitmapfont`, Fedora
  `wqy-bitmap-fonts`, and the vectorised fork at
  <https://github.com/AmusementClub/WenQuanYi-Bitmap-Song-TTF>.

The repo does not bundle the GPL text verbatim; the upstream project is the
canonical source. If you redistribute `wqy-song.woff2` outside this repo, include
the copyright line above and a link / copy of GPL-2.0 + the exception statement.

---

## 4. Liberation Serif / Liberation Mono subsets — SIL Open Font License 1.1

These two faces are **subsets** of the Liberation family. Only the glyphs the
shell needs are kept; everything else is dropped to keep the download small.

* Upstream: *Liberation Serif* and *Liberation Mono* — metric-compatible
  alternatives to Times New Roman / Courier New
* Copyright as declared upstream:

  ```
  Digitized data copyright (c) 2010 Google Corporation
  with Reserved Font Name Arimo, Tinos and Cousine.
  Copyright (c) 2012 Red Hat, Inc. with Reserved Font Name Liberation.
  ```

* Licence: **SIL Open Font License 1.1** — full text reproduced below.
* Reserved Font Names `Arimo`, `Tinos`, `Cousine`, `Liberation` are **not used**
  by the subsets; they ship as `W95 Serif` / `W95 Mono`.

### Full licence text

```
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The fonts,
including any derivative works, can be bundled, embedded, redistributed
and/or sold with any software provided that any reserved names are not used
by derivative works. The fonts and derivatives, however, cannot be released
under any other type of license. The requirement for fonts to remain under
this license does not apply to any document created using the fonts or
their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may include
source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting, or
substituting -- in part or in whole -- any of the components of the Original
Version, by changing formats or by porting the Font Software to a new
environment.

"Author" refers to any designer, engineer, programmer, technical writer or
other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining a copy
of the Font Software, to use, study, copy, merge, embed, modify, redistribute,
and sell modified and unmodified copies of the Font Software, subject to the
following conditions:

1) Neither the Font Software nor any of its individual components, in Original
   or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
   redistributed and/or sold with any software, provided that each copy
   contains the above copyright notice and this license. These can be
   included either as stand-alone text files, human-readable headers or in
   the appropriate machine-readable metadata fields within text or binary
   files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font Name(s)
   unless explicit written permission is granted by the corresponding Copyright
   Holder. This restriction only applies to the primary font name as presented
   to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software
   shall not be used to promote, endorse or advertise any Modified Version,
   except to acknowledge the contribution(s) of the Copyright Holder(s) and
   the Author(s) or with their explicit written permission.

5) The Font Software, modified or unmodified, in part or in whole, must be
   distributed entirely under this license, and must not be distributed under
   any other license. The requirement for fonts to remain under this license
   does not apply to any document created using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT,
TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL,
INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE
THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.
```

The same OFL text covers § 1 (W95FA).

---

## 5. DejaVu Sans / DejaVu Sans Mono subsets — Bitstream Vera licence

These two files supply symbols and fallback glyphs that W95FA does not cover.

* Upstream: *DejaVu Sans* and *DejaVu Sans Mono*, themselves derived from
  *Bitstream Vera*
* Copyright as declared upstream:

  ```
  Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved.
  Bitstream Vera is a trademark of Bitstream, Inc.
  DejaVu changes are in public domain.
  ```

* Licence: **Bitstream Vera licence** — full text reproduced below.
* Renamed to `W95 Symbols` so no modified face is distributed under `Bitstream`
  or `Vera`.

### Full licence text

```
Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. Bitstream Vera is
a trademark of Bitstream, Inc. DejaVu changes are in public domain.

Permission is hereby granted, free of charge, to any person obtaining a copy
of the fonts accompanying this license ("Fonts") and associated documentation
files (the "Font Software"), to reproduce and distribute the Font Software,
including without limitation the rights to use, copy, merge, publish,
distribute, and/or sell copies of the Font Software, and to permit persons to
whom the Font Software is furnished to do so, subject to the following
conditions:

The above copyright and trademark notices and this permission notice shall be
included in all copies of one or more of the Font Software typefaces.

The Font Software may be modified, altered, or added to, and in particular the
designs of glyphs or characters in the Fonts may be modified and additional
glyphs or characters may be added to the Fonts, only if the fonts are renamed
to names not containing either the words "Bitstream" or the word "Vera".

This License becomes null and void to the extent applicable to Fonts or Font
Software that has been modified and is distributed under the "Bitstream Vera"
names.

The Font Software may be sold as part of a larger software package but no copy
of one or more of the Font Software typefaces may be sold by itself.

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT,
TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL BITSTREAM OR THE GNOME
FOUNDATION BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY
GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN
AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR
INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT
SOFTWARE.
```

---

## Compliance notes

* **No re-licensing.** OFL faces (W95FA, Liberation subsets) stay under OFL;
  Bitstream Vera subsets stay under Bitstream Vera + public domain; WenQuanYi
  stays under GPL-2.0+FE; Roboto stays under Apache 2.0. Mixing them in one
  `.woff2` bundle is allowed — each file keeps its own licence.
* **Documents you create** with these fonts (screenshots, exported text, PDFs)
  are **not** covered by OFL/GPL — only the font files themselves are.
* **Selling the desktop** is allowed, but you may not sell any of these font
  files "by themselves".
* If you redistribute this repository, keep this file and the copyright notices
  inside each font's name table.

---

## History of this document

* This file was introduced to replace ad-hoc "bundled before this list existed /
  unchanged" rows. `w95fa.woff2`, `roboto-regular-ascii.woff2` and
  `wqy-song.woff2` now have explicit provenance and licences, matching the
  actual files shipped since the first commit.
* Subset tooling is documented in `tools/font-glyphs.py`.
