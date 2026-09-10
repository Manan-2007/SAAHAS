import librosa
import numpy as np

TARGET_SR = 22050

def extraction_from_audio(audio , sr , max_len = 174 , n_mfcc = 40):
    """Compute the (max_len, n_mfcc) MFCC matrix the model expects from raw samples."""
    audio = np.asarray(audio , dtype = np.float32)
    if sr != TARGET_SR:
        audio = librosa.resample(audio , orig_sr = sr , target_sr = TARGET_SR)

    mfcc = librosa.feature.mfcc(y = audio , sr = TARGET_SR , n_mfcc = n_mfcc)

    if mfcc.shape[1] < max_len:
        pad = max_len - mfcc.shape[1]
        mfcc = np.pad(mfcc , ((0,0) , (0 , pad)) , mode = 'constant')
    else:
        mfcc = mfcc[: , :max_len]

    return mfcc.T

def extraction(filepath , max_len = 174 , n_mfcc = 40):
    audio , sr = librosa.load(filepath , sr = TARGET_SR , res_type="kaiser_fast")
    return extraction_from_audio(audio , sr , max_len = max_len , n_mfcc = n_mfcc)
