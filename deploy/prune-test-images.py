#!/usr/bin/env python3
"""Plan/remove only untagged historical YC test images recorded by this deployment SOP."""
import argparse, datetime, json, re, subprocess
from pathlib import Path
OPS = Path('/Users/yoki/ServerData/operations/yc-test')
NAMES = {'yc-h5-test','yc-acceptance-backend'}
def run(*args): return subprocess.run(args,capture_output=True,text=True,check=True).stdout

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--keep-history',type=int,choices=[1,2,3],default=2)
    parser.add_argument('--max-images',type=int,default=16)
    args=parser.parse_args()
    if not 1<=args.max_images<=30: parser.error('max-images must be 1..30')
    # Preserve every existing container, including stopped ones, and all tagged images.
    containers=run('docker','ps','-aq').split()
    used={item['Image'] for item in json.loads(run('docker','inspect',*containers))} if containers else set()
    snapshots=sorted(OPS.glob('before-*.json'),key=lambda p:p.stat().st_mtime)
    seen={name:[] for name in NAMES}
    for path in snapshots:
        data=json.loads(path.read_text())
        for name,image in data.get('images',{}).items():
            if name in NAMES and isinstance(image,str) and re.fullmatch('sha256:[0-9a-f]{64}',image):
                if image in seen[name]: seen[name].remove(image)
                seen[name].append(image)
    protected=used | {image for values in seen.values() for image in values[-args.keep_history:]}
    plan=[]
    for name,values in sorted(seen.items()):
        for image in values:
            if image in protected or any(item['image']==image for item in plan): continue
            result=subprocess.run(['docker','image','inspect',image],capture_output=True,text=True)
            if result.returncode: continue
            info=json.loads(result.stdout)[0]
            if info.get('RepoTags') or info.get('RepoDigests'): continue
            plan.append({'containerHistory':name,'image':image,'size':info['Size']})
    plan=plan[:args.max_images]
    evidence={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'execute' if args.execute else 'plan','preservedRecentHistoryImages':sorted(protected-used),'plan':plan,'results':[]}
    if args.execute:
        for item in plan:
            # No --force and no volume/container deletion; Docker rejects an image newly referenced in a race.
            result=subprocess.run(['docker','image','rm',item['image']],capture_output=True,text=True)
            evidence['results'].append({'image':item['image'],'removed':result.returncode==0,'error':result.stderr.strip() if result.returncode else ''})
        filename='test-image-cleanup-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json'
        (OPS/filename).write_text(json.dumps(evidence,indent=2))
    print(json.dumps(evidence,indent=2))
if __name__=='__main__': main()
