module jsexport

go 1.18

require (
	github.com/gopherjs/gopherjs v1.18.0-beta1
	resolv v0.0.0
)

replace (
	resolv => ../resolv_tailored
)
