# Double playback speed of a video
```
ffmpeg -i input.mp4 -filter:v "setpts=0.5*PTS" output.mp4
```

# GIF creation cmd reference
```
ffmpeg -ss 12 -t 13 -i input.mp4 -vf "fps=10,scale=480:-1" -loop 0 output.gif
```

# Extract GIF (with alpha channel, e.g. exported from Fighter Factory Studio) to PNG sequence
```
ffmpeg -vsync vfr -i input.gif output%d.png
```

The `-vsync vfr` tells ffmpeg to disrespect the original delays set within the GIF file, otherwise many duplicate frame will be extracted by the default 60FPS.
