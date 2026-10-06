import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';

const MODEL = 'gpt-image-2.5-sunburst';
const SHORTS_PROMPT = `MASK-ONLY SHORTS REPLACEMENT.

IMAGE 1 = BASE/MODEL IMAGE.
IMAGE 2 = EXACT SHORTS REFERENCE.
MASK = ONLY PERMITTED EDITING REGION.

Edit IMAGE 1 only.

Replace ONLY the shorts garment inside the supplied mask with the shorts shown in IMAGE 2.

IMAGE 2 is the authoritative garment reference. Reproduce its shorts exactly, including:
- exact color
- exact print/artwork
- exact pattern identity
- pattern scale, spacing and orientation
- fabric appearance and texture
- waistband
- drawstring
- pockets
- seams
- stitching
- hems
- markings/logos
- length
- cut
- proportions
- construction and design details

Do NOT recolor, redesign, simplify, reinterpret, approximate, invent, or substitute any garment detail.

The ONLY permitted transformation of the reference garment is the geometric adaptation required to fit the existing body and pose in IMAGE 1. Preserve the reference garment while naturally adapting perspective, scale, folds, wrinkles, tension, drape and occlusion to the existing pose.

THE BASE IMAGE IS IMMUTABLE OUTSIDE THE MASK.

Do NOT change anything outside the mask, including:
person identity, face, hair, skin, body, anatomy, body proportions, pose, hands, arms, legs, feet, shoes, shirt, accessories, background, lighting, shadows, exposure, framing, camera angle, perspective, depth of field, image quality, sharpness or composition.

Do NOT retouch, enhance, relight, sharpen, denoise, regenerate or improve the base image.

The mask defines the ONLY area that may be changed.

BASE IMAGE controls everything outside the mask.
SHORTS REFERENCE controls the garment design inside the mask.

Make no creative changes outside the masked shorts region.`;

const MODEL_META = {
  model1: { label: 'Front / full body' },
  model2: { label: 'Side / three-quarter' },
  model3: { label: 'Back view' },
  model4: { label: 'Front / hand in pocket' },
};

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'OPENAI_API_KEY is not configured in Netlify environment variables.' }, { status: 500 });

  try {
    const form = await req.formData();
    const baseFile = form.get('baseImage');
    const maskFile = form.get('mask');
    const shortsFile = form.get('shortsReference');
    const modelId = String(form.get('modelId') || 'custom');

    if (!(baseFile instanceof File) || !(maskFile instanceof File) || !(shortsFile instanceof File)) {
      return Response.json({ error: 'baseImage, mask and shortsReference are required.' }, { status: 400 });
    }
    if (modelId !== 'custom' && !MODEL_META[modelId]) return Response.json({ error: 'Invalid model.' }, { status: 400 });

    const [base, mask, shorts] = await Promise.all([
      Buffer.from(await baseFile.arrayBuffer()),
      Buffer.from(await maskFile.arrayBuffer()),
      Buffer.from(await shortsFile.arrayBuffer()),
    ]);

    await validateMask(mask, base);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.images.edit({
      model: MODEL,
      image: [
        await toFile(base, baseFile.name || 'base.jpg'),
        await toFile(shorts, shortsFile.name || 'shorts-reference.jpg'),
      ],
      mask: await toFile(mask, 'mask.png'),
      prompt: SHORTS_PROMPT,
      quality: 'high',
      size: 'auto',
      output_format: 'png',
      background: 'opaque',
      n: 1,
    });

    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI returned no image data.');
    return Response.json({ id: modelId, label: MODEL_META[modelId]?.label || 'Custom model', image: `data:image/png;base64,${b64}` }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error?.message || 'Generation failed.' }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
};

export const config = {
  path: '/api/edit',
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['ip'],
    windowSize: 60,
    windowLimit: 12,
  },
};

async function validateMask(mask, base) {
  if (!mask || !base) throw new Error('Base image and mask are required.');
  if (mask.length >= 4 * 1024 * 1024) throw new Error('Mask must be under 4 MB.');
  const [mm, bm] = await Promise.all([sharp(mask).metadata(), sharp(base).metadata()]);
  if (mm.format !== 'png') throw new Error('Mask must be a PNG.');
  if (!mm.hasAlpha) throw new Error('Mask must contain transparency/alpha.');
  if (mm.width !== bm.width || mm.height !== bm.height) {
    throw new Error(`Mask ${mm.width}x${mm.height} must match base ${bm.width}x${bm.height}.`);
  }
}
