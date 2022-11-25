# Double playback speed of a video
```
ffmpeg -i input.mp4 -filter:v "setpts=0.5*PTS" output.mp4
```

# GIF creation cmd reference
```
ffmpeg -ss 12 -t 13 -i input.mp4 -vf "fps=10,scale=480:-1" -loop 0 output.gif
```
