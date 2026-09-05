"""Central config so tuning doesn't mean hunting through every module."""

SAMPLE_RATE = 16000          
FRAME_MS = 30               
VAD_AGGRESSIVENESS = 1
PADDING_MS = 800
RATIO_TRIGGER = 0.75    

WHISPER_MODEL_SIZE = "small"   
WHISPER_DEVICE = "cpu"         
WHISPER_COMPUTE_TYPE = "int8"  

GROQ_MODEL = "openai/gpt-oss-120b"
