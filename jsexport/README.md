GopherJs is supposed to be run by `go run`. 

If on-the-fly compilation is needed, run `gopherjs serve jsexport` and then visit `http://localhost:8080/jsexport.js` -- if 404 not found is responded, run `gopherjs build` to check syntax errors.

See the `Makefile` for more options.
