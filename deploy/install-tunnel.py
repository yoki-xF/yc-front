"""Install the authorized yc-test reverse tunnel on Mac mini; never replaces an existing definition."""
import os,plistlib,subprocess
from pathlib import Path
root=Path('/Users/yoki/ServerData/operations/yc-test');root.mkdir(parents=True,exist_ok=True)
path=Path('/Users/yoki/Library/LaunchAgents/ink.yoki.yc-test-tunnel.plist')
if path.exists():raise SystemExit('Tunnel definition already exists; inspect rather than overwrite')
args=['/usr/bin/ssh','-4','-NT','-i','/Users/yoki/.ssh/batch_manager_aliyun_ed25519']
for option in ['IdentitiesOnly=yes','IdentityAgent=none','BatchMode=yes','StrictHostKeyChecking=yes','HostKeyAlias=8.163.27.230','ExitOnForwardFailure=yes','ConnectTimeout=15','ServerAliveInterval=15','ServerAliveCountMax=3']:args.extend(['-o',option])
args.extend(['-R','127.0.0.1:15181:127.0.0.1:15181','root@ip.yoki.ink'])
path.write_bytes(plistlib.dumps({'Label':'ink.yoki.yc-test-tunnel','ProgramArguments':args,'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':30,'StandardOutPath':str(root/'tunnel.log'),'StandardErrorPath':str(root/'tunnel.log')}));path.chmod(0o600)
subprocess.run(['launchctl','bootstrap','gui/'+str(os.getuid()),str(path)],check=True)
