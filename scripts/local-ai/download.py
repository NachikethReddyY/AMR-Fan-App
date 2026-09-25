"""Download only pinned inference artifacts to the shared cache; never load a model."""
import json
from pathlib import Path
from huggingface_hub import snapshot_download

cache = Path.home() / '.cache/amr/laya/huggingface'
pins = json.loads((Path(__file__).parent / 'models.json').read_text())
for name, pin in pins['models'].items():
    path = snapshot_download(pin['repo'], revision=pin['revision'], cache_dir=str(cache / 'hub'), token=False,
                             allow_patterns=['rl_agent_config.json','model.safetensors','tokenizer/*.json','tokenizer/*.model','encoder/*.json'], max_workers=2)
    print(json.dumps({'model':name,'revision':pin['revision'],'downloaded':True}), flush=True)
