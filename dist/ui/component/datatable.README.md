sprat.rest.datatable.js
=======================
jQuery Datatable binding for Spring Data REST services.

Usage
-----
The generic usage is straightforward:

	<head>
		<!-- CSS -->
		<link rel="stylesheet" href="datatables/media/css/jquery.dataTables.css" />
		
		<!-- add external dependencies -->
		<script type="text/javascript" src="datatables/media/js/jquery.dataTables.min.js'"></script>
		<!-- add redistributed libraries -->
		<script src="$PATH/vendor/jsonselect.js"></script>
		<!-- add Sprat dependencies -->
		<script src="$PATH/dist/wrestle.js"></script>
		<script src="$PATH/dist/ui/component/datatable.js"></script>
	</head>
	
	<body>
		<!-- define your table -->
		<table class="table table-striped table-bordered" id="listView">
			<thead>
				<tr>
					<!-- Columns can be mapped by their property name. Use "rdt-property" for retrieving them by their key -->
					<!-- The CSS class rdt-is-orderable marks the column as orderable -->
					<th rdt-property="name" class="rdt-is-orderable">Name</th>
					<th rdt-property="count">Count</th>
					<!-- we can define our custom renderer which must be defined with sprat.ui.renderer.register('renderer_name', callback) -->
					<th rdt-renderer="my_renderer">Datatype</th>
					<th rdt-property="description">Description</th>
					<!-- rdt-alias is used for columns which have no corresponding property -->
					<th rdt-alias="actions">Aktionen</th>
				</tr>
			</thead>
			<tbody>
			</tbody>
		</table>
	
		<!-- initialize jQuery datatable -->
		<script type="text/javascript">
			sprat.ui.component.dataTable()
			.bindTable($('#listView'))
			.toEndpoint("/rest/units")
			.withSpringDataAttribute("units")
			.mapColumns({
				"actions": function(data) {
					return "Actions"
				}
			})
			.build();
		</script>
	</body>
	
Please examine the test/ui/component/datatable.sample.html for further details. 