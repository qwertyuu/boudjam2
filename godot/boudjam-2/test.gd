extends Node2D


func _ready():
	# Retrieve the `window.console` object.
	var console = JavaScriptBridge.get_interface("console")
	# Call the `window.console.log()` method.
	console.log("test")

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
