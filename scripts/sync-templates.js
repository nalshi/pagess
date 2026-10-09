import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const templatesDir = path.resolve(rootDir, 'templates');
const themesSubDir = path.resolve(templatesDir, 'themes');
const themePalettesPath = path.resolve(templatesDir, 'theme-palettes.json');
const emeraldThemePath = path.resolve(themesSubDir, 'emerald.json');
const { createThemeColors } = await import('../src/shared/themePaletteFactory.js');

function generatePremiumThemes() {
  const palettes = JSON.parse(fs.readFileSync(themePalettesPath, 'utf8'));
  const emerald = JSON.parse(fs.readFileSync(emeraldThemePath, 'utf8'));
  const existingIds = new Map();
  const paletteIds = new Set();

  for (const palette of palettes) {
    if (!palette.id || paletteIds.has(palette.id)) {
      throw new Error(`معرف ثيم مفقود أو مكرر في ${themePalettesPath}: ${palette.id || '(فارغ)'}`);
    }
    paletteIds.add(palette.id);
  }

  for (const file of fs.readdirSync(themesSubDir).filter(file => file.endsWith('.json'))) {
    if (file === 'emerald.json') continue;
    const existing = JSON.parse(fs.readFileSync(path.join(themesSubDir, file), 'utf8'));
    if (existing.id) existingIds.set(existing.id, file);
  }

  for (const palette of palettes) {
    const conflictingFile = existingIds.get(palette.id);
    if (conflictingFile && conflictingFile !== `${palette.id}.json`) {
      throw new Error(`معرف الثيم ${palette.id} مستخدم مسبقاً في ${conflictingFile}`);
    }

    const destination = path.join(themesSubDir, `${palette.id}.json`);
    if (fs.existsSync(destination)) {
      const existingTheme = JSON.parse(fs.readFileSync(destination, 'utf8'));
      if (existingTheme.id !== palette.id) {
        throw new Error(`لن يتم استبدال ملف ثيم موجود بمعرف مختلف: ${destination}`);
      }
    }

    const theme = JSON.parse(JSON.stringify(emerald));
    theme.id = palette.id;
    theme.name = palette.name;
    theme.description = palette.description;
    theme.category = palette.category;
    theme.preview = {
      primary: palette.light.primary,
      accent: palette.light.accent,
      background: palette.light.body
    };
    theme.config.theme_name = palette.id;
    theme.config.light_theme.colors = createThemeColors(emerald.config.light_theme.colors, palette, 'light');
    theme.config.dark_theme.colors = createThemeColors(emerald.config.dark_theme.colors, palette, 'dark');
    theme.config.assistant.accent_color = palette.light.primary;

    fs.writeFileSync(
      destination,
      JSON.stringify(theme, null, 2),
      'utf8'
    );
  }

  return palettes.length;
}

/**
 * فحص واكتشاف كافة قوالب الـ JSON تلقائياً في templates/themes/ و templates/
 * وبناء ملف themes.json الموحد بدون أي حاجة لملف manifest.json يدوي.
 */
export function scanAndSyncThemes() {
  console.log('🎨 [Templates Sync] جاري فحص واكتشاف قوالب المتجر في مجلد templates/ ...');
  const generatedCount = generatePremiumThemes();
  console.log(`🎨 [Templates Sync] تم توليد ${generatedCount} ثيماً جديداً من الألوان المعتمدة.`);

  const discoveredItems = [];
  const visitedIds = new Set();

  function processJsonFile(filePath, relativePath) {
    try {
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);

      const filename = path.basename(filePath);
      // استبعاد ملفات النظام غير المخصصة كقوالب متاجر
      if (['manifest.json', 'fonts.json', 'layouts.json', 'navigation.json', 'bots.json', 'themes-index.json'].includes(filename)) {
        return;
      }
      if (filename === 'themes.json' || filename === 'theme-palettes.json') return;

      if (data && typeof data === 'object') {
        const id = String(data.id || filename.replace(/\.json$/i, '').replace(/^theme_/, '')).trim().toLowerCase();
        if (!id || visitedIds.has(id)) return;
        visitedIds.add(id);

        const config = data.config || (data.light_theme ? data : null);
        const lightColors = config?.light_theme?.colors || data.preview || {};

        const themeItem = {
          id,
          name: data.name || `قالب ${id}`,
          description: data.description || 'تصميم جاهز قابل للتخصيص لمتجرك.',
          category: data.category || 'قوالب المتجر',
          preview: {
            primary: data.preview?.primary || lightColors.primary || '#4F46E5',
            accent: data.preview?.accent || lightColors.accent || '#06B6D4',
            background: data.preview?.background || lightColors.bg_body || '#F8FAFC'
          },
          sourceFile: relativePath.replace(/\\/g, '/'),
          config: config || {}
        };

        discoveredItems.push(themeItem);
        console.log(`  ✓ تم اكتشاف القالب: "${themeItem.name}" [${id}] من (${relativePath})`);
      }
    } catch (err) {
      console.warn(`  ⚠️ تعذر قراءة ملف القالب ${relativePath}:`, err.message);
    }
  }

  // 1. فحص مجلد templates/themes/
  if (fs.existsSync(themesSubDir)) {
    const files = fs.readdirSync(themesSubDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        processJsonFile(path.join(themesSubDir, file), `/templates/themes/${file}`);
      }
    }
  }

  // 2. فحص مجلد templates/ لأي ملفات theme_*.json إضافية
  if (fs.existsSync(templatesDir)) {
    const files = fs.readdirSync(templatesDir);
    for (const file of files) {
      if (file.endsWith('.json') && (file.startsWith('theme') || file.includes('theme'))) {
        if (file !== 'themes.json') {
          processJsonFile(path.join(templatesDir, file), `/templates/${file}`);
        }
      }
    }
  }

  // 3. كتابة ملف themes.json المحدث ليكون الفهرس الرسمي الجاهز بدون أي حاجة لـ manifest
  const outputThemes = {
    version: 2,
    updated_at: new Date().toISOString(),
    count: discoveredItems.length,
    items: discoveredItems
  };

  const themesJsonPath = path.join(templatesDir, 'themes.json');
  fs.writeFileSync(themesJsonPath, JSON.stringify(outputThemes, null, 2), 'utf8');
  console.log(`✅ [Templates Sync] تم تحديث مكتبة القوالب بنجاح (${discoveredItems.length} قالب متاح) في templates/themes.json`);

  return discoveredItems;
}

// تشغيل مباشر
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scanAndSyncThemes();
}
