extends Camera2D

# Vitesse de déplacement de la caméra (pixels par seconde)
@export var speed: float = 300.0

# Vitesse de zoom (optionnel)
@export var zoom_speed: float = 0.1

func _ready():
	pass

func _process(delta):
	# Récupérer l'input directionnel (WASD ou flèches)
	var direction = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")

	# Calculer le mouvement
	var movement = direction * speed * delta

	# Déplacer la caméra
	position += movement

	# Optionnel : Contrôle du zoom avec molette ou touches
	if Input.is_action_just_pressed("ui_page_up"):
		zoom *= 1.0 + zoom_speed
	elif Input.is_action_just_pressed("ui_page_down"):
		zoom *= 1.0 - zoom_speed
