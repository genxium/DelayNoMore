GopherJs is NOT supposed to be run by `go run` but `gopherjs <args>` instead. 

If on-the-fly compilation is needed, run `gopherjs serve jsexport` and then visit `http://localhost:8080/jsexport.js` -- if 404 not found is responded, run `gopherjs build` to check syntax errors.

See the `Makefile` for more options.

Kindly note that the sources of the greate opensource projects [resolv](https://github.com/SolarLune/resolv) and [vector](https://github.com/quartercastle/vector) are copied and modified here to reduce the size of generated js codes, i.e. standard libs `fmt`, `error`, `pb`(including standard libs `sync` and `reflect`) are deliberately avoided from scratch. 
