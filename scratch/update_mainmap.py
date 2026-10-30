import os

path = r'c:\Users\Sid\eco-terminal\EcoTerminal\frontend\src\components\map\MainMap.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Lucide icon import
content = content.replace(
    "import { Compass, Layers, Sparkles, X, ZoomIn, ZoomOut } from 'lucide-react';",
    "import { Layers, Maximize2, Sparkles, X, ZoomIn, ZoomOut } from 'lucide-react';"
)

# 2. Remove is3D
content = content.replace("  const [is3D, setIs3D] = useState(false);\r\n", "")
content = content.replace("  const [is3D, setIs3D] = useState(false);\n", "")

# 3. Remove toggle3D
content = content.replace("""  const toggle3D = (enable3D: boolean) => {
    setIs3D(enable3D);
    if (!mapInstance) return;
    if (typeof (mapInstance as any).easeTo === 'function') {
      (mapInstance as any).easeTo({
        pitch: enable3D ? 52 : 0,
        bearing: enable3D ? -15 : 0,
        duration: 900,
      });
    }
  };
""", "")
content = content.replace("""  const toggle3D = (enable3D: boolean) => {
    setIs3D(enable3D);
    if (!mapInstance) return;
    if (typeof (mapInstance as any).easeTo === 'function') {
      (mapInstance as any).easeTo({
        pitch: enable3D ? 52 : 0,
        bearing: enable3D ? -15 : 0,
        duration: 900,
      });
    }
  };\r\n""", "")

# 4. Map options
old_map = """    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleDef,
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      minZoom: 3,
      maxZoom: 18,
      attributionControl: false,
    });"""

new_map = """    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleDef,
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      minZoom: 3,
      maxZoom: 18,
      attributionControl: false,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });"""

content = content.replace(old_map.replace('\n', '\r\n'), new_map.replace('\n', '\r\n'))
content = content.replace(old_map, new_map)

# 5. Remove pitch event listeners
content = content.replace("    mapInstance.on('pitch', syncTooltipPosition);\r\n", "")
content = content.replace("    mapInstance.on('pitch', syncTooltipPosition);\n", "")
content = content.replace("      mapInstance.off('pitch', syncTooltipPosition);\r\n", "")
content = content.replace("      mapInstance.off('pitch', syncTooltipPosition);\n", "")

# 6. Remove 2D / 3D button toggle UI block
import re
pattern_2d_3d = r'\s*<div className="flex items-center rounded-lg border border-eco-border bg-eco-surface/90 p-0.5 shadow-lg backdrop-blur-md">\s*<button[\s\S]*?onClick=\{\(\) => toggle3D\(false\)\}[\s\S]*?3D\s*</button>\s*</div>'
content = re.sub(pattern_2d_3d, '', content)

# 7. Replace Compass button with Maximize2
content = content.replace(
    '<Compass className="w-4 h-4 text-eco-primary" />',
    '<Maximize2 className="w-4 h-4 text-eco-primary" />'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done. Verification:")
print("is3D in content:", "is3D" in content)
print("toggle3D in content:", "toggle3D" in content)
print("Compass in content:", "Compass" in content)
print("Maximize2 in content:", "Maximize2" in content)
print("maxPitch in content:", "maxPitch" in content)

