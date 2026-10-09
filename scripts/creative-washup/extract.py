"""Turn raw Motion get_creative_insights responses into one creatives.json.

    python3 -I scripts/creative-washup/extract.py <run-dir>

Reads <run-dir>/raw/<slug>.json (one saved Motion response per workspace,
slug as in workspaces.json; later pages may be saved as <slug>-p2.json, <slug>-p3.json)
and writes <run-dir>/creatives.json.
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RUN = sys.argv[1]
CFG = json.load(open(os.path.join(HERE, 'workspaces.json')))
WS = {w['slug']: w for w in CFG['workspaces']}
PREF = ['4:5', '1:1', '9:16', '16:9']
METRICS = ['spend', 'impressions', 'cpm', 'ctr_outbound', 'thumbstop_ratio', 'video_thruplay_ratio',
           'leads_all', 'view_content', 'purchase_count', 'purchase_value', 'roas', 'add_to_cart']


def pick(lst, key):
    if not lst:
        return None, None
    lst = sorted(lst, key=lambda x: PREF.index(x.get('aspectRatio')) if x.get('aspectRatio') in PREF else 9)
    return lst[0].get(key), lst[0].get('aspectRatio')


def public_preview(ad, ca, video_url):
    """A long-lived public image URL (Motion blob storage) for Sheet previews."""
    blob = 'motionaccountassets.blob.core.windows.net'
    img, _ = pick(ad.get('images'), 'url')
    if img and blob in img:
        return img
    for u in (ad.get('largeThumbnailUrl'), ad.get('thumbnailUrl')):
        if u and blob in u:
            return u
    if video_url and blob in video_url:
        return video_url.rsplit('/', 1)[0] + '/cover.jpg'
    if ca.get('publicUrl') and ca.get('creativeFormat') == 'image':
        return ca['publicUrl']
    return None


out = []
seen = set()
for f in sorted(glob.glob(os.path.join(RUN, 'raw', '*.json'))):
    slug = re.sub(r'-p\d+$', '', os.path.basename(f)[:-5])
    w = WS.get(slug)
    if not w:
        print('skip unknown workspace file', f)
        continue
    dd = json.load(open(f))['data']['data']
    assets = {a['_id']: a for a in dd.get('creativeAssets', [])}
    for row in dd['insightsResult']['data']['insights']:
        ad, m = row['ad'], row['insights']
        key = f"{slug}:{row.get('creativeAssetId') or row.get('creativeKey')}"
        if key in seen:
            continue
        seen.add(key)
        ca = assets.get(row.get('creativeAssetId')) or {}
        vid, vid_ar = pick(ad.get('videos'), 'videoAssetUrl')
        img, img_ar = pick(ad.get('images'), 'url')
        video = vid or ad.get('videoAssetUrl') or (ca.get('publicUrl') if ca.get('creativeFormat') == 'video' else None)
        image = img or ad.get('imageUrl') or (ca.get('publicUrl') if ca.get('creativeFormat') == 'image' else None)
        cards = [{'img': c.get('imageUrl') or c.get('thumbnailUrl')} for c in (ad.get('cards') or [])]
        is_video = (m.get('thumbstop_ratio') or 0) > 2
        lp = ad.get('landingPageUrl') or ((ad.get('landingPageUrls') or [{}])[0].get('url'))
        out.append({
            'key': key, 'slug': slug, 'client': w['name'], 'cur': w['cur'], 'ecom': w['ecom'],
            'adName': ad.get('adName'), 'adset': ad.get('adsetName'), 'campaign': ad.get('campaignName'),
            'is_video': is_video, 'video': video if is_video else None,
            'image': image, 'thumb': ad.get('largeThumbnailUrl') or ad.get('thumbnailUrl'),
            'cardImg': cards[0]['img'] if cards else None, 'cards': len(cards),
            'preview': public_preview(ad, ca, video),
            'videoLength': ad.get('videoLength') or (ad.get('videos') or [{}])[0].get('videoLength'),
            'texts': [t['text'] for t in ad.get('adTexts') or []],
            'titles': [t['text'] for t in ad.get('titles') or []],
            'descs': [t['text'] for t in ad.get('descriptions') or []],
            'landing': lp,
            'launch': (row.get('launchDate') or '')[:10], 'spendState': row.get('spendState'),
            'creativeEntityId': row.get('creativeAssetId'),
            'creativeOrigin': ca.get('creativeOrigin', 'metaCreativeAsset'),
            'workspaceId': w['id'],
            'm': {k: m.get(k) for k in METRICS},
        })

json.dump(out, open(os.path.join(RUN, 'creatives.json'), 'w'), indent=1, ensure_ascii=False)
print(f'{len(out)} creatives from {len(set(x["slug"] for x in out))} accounts')
