module dnmshared 

go 1.18

require (
	resolv v0.0.0
	jsexport v0.0.0
)

replace (
	resolv => ../resolv_tailored
	jsexport => ../jsexport
)
