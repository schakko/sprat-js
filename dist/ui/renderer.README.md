# sprat.ui.renderer
sprat.ui.render is a registry for string renderers which can be used for transforming data objects into viewable strings.

###  Registering a new renderer
The sprat.ui.renderers object can be extended by the developer to register a new renderer. Renderer are always callback functions or an JavaScript object with the property "ui".

The following renderer is used for a datatable integration

	sprat.ui.renderer.renderers.profile = {
		list : {
			displayName : function(data, type, full, instance) {
				return c.postname + ", " + c.prename;
			}
		}
	}
	
### Retrieve an existing renderer
Registered renderers can be easily retrieved by calling them by their object path. The previous registered renderer can be retrieved with

	sprat.ui.renderer.get("profile.list.displayName")