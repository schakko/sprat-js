# sprat.ui.datetime

Convert backend and frontend date formats. It supports UTC dates in the backend. Input fields annotated with CSS class .datepicker or .datepicker-with-time are rendered with a datepicker element by default.

## Usage
### Java and Thymeleaf

*pom.xml*

	<!-- Date/Time picker -->
	<dependency>
		<groupId>org.webjars</groupId>
		<artifactId>Eonasdan-bootstrap-datetimepicker</artifactId>
		<version>4.0.0</version>
	</dependency>
	<dependency>
		<groupId>org.webjars</groupId>
		<artifactId>momentjs</artifactId>
		<version>2.9.0</version>
	</dependency>

*page.html*

	<!-- require moment.js; must be included before boostrap-datetimepicker -->
	<script type="text/javascript" src="path/to/momentjs.js"></script>

	<!-- get bootstrap-datetimepicker as dependency -->
	<link rel="stylesheet" th:href="@{/webjars/Eonasdan-bootstrap-datetimepicker/4.0.0/bootstrap-datetimepicker.css}" />
	<script type="text/javascript" th:src="@{/webjars/Eonasdan-bootstrap-datetimepicker/4.0.0/bootstrap-datetimepicker.min.js}"></script>

	<!-- include sprat-js -->
	<script type="text/javascript" src="path/to/datetime/sprat.ui.datetime.js"></script>

	<!-- define input/output fields -->
	<input type="hidden" th:field="*{{birthday}}" />
	<input type="text" th:value="*{{birthday}}" backing-field="birthday" class="form-control datepicker" /> 

	<!-- initialize sprat.ui.datetime -->
	<script type="text/javascript">
		// must be called to initialize the fields
		sprat.ui.datetime.init({ /* no options */});
	</script>
	
### Configuration
.init accepts an object with configuration parameters:

	cssInputSelector	jQuery selector prefix defining datepicker inputs, defaults to ".datepicker"
	cssOutputSelector	jQuery selector prefix defining date outputs, defaults to ".dateformat"
	customFormatAttribute	Format the output with the given momentjs expression, defaults to "date-format"
	cssSuffix			defaults to none and will be overwritten by the format array
	backendIsInUTC		boolean; will the input and output fields be converted to local user/UTC backend time, defaults to true
	backingFieldAttribute	store UTC date in this input hidden field
	formats				array of objects, see below
	datetimepicker		custom options for Eonasdan-bootstrap-datetimepicker; "calenderWeeks" are enabled by default
	
Every object inside the "formats" array should define a specific CSS class suffix for input and output date/datetimes. Every option name from the default configuration can be overwritten. The object must at least contain the following properties:

	backendFormat	momentjs format describing how the backend stores the date/times
	frontendFormat	momentjs format describing how the user sees the backend stored date/times

To define different types of format, you must use the cssSuffix option.

	'formats' : [ 
		/* define format with date only. Usage: "<input type='text' class='datepicker' />" for input and "<span class='dateformat' />" for output */		
		{
			'backendFormat' : 'DD.MM.YYYY',
			'frontendFormat' : 'DD.MM.YYYY',
			'datetimepicker' : {
				calendarWeeks : true
			}
		}, 
		/* define format with date and time. Usage: "<input type='text' class='datepicker-with-time' />" for input and "<span class='dateformat-with-time' />" for output */		
		{
			'cssSuffix' : '-with-time',
			'backendFormat' : 'DD.MM.YYYY HH:mm',
			'frontendFormat' : 'DD.MM.YYYY HH:mm'
		}
	]

Samples
=======
The following samples uses Thymeleaf as templating engine. The imaginary backend uses UTC so every (visible) input field holds the local date/time of the user and every (hidden) field stores the real date/times the backend uses later.

sprat.ui.datetime.init() must be called after the template has been rendered.

Converting dates
-----------------
Assuming that the variable "birthday" has the (backend) format "YYYY-mm-dd" in UTC.

	<span th:text="${{birthday}}" class="dateformat"></span>

	<script type="text/javascript">
		// UTC is implicitly activated
		sprat.ui.datetime.init({ 
			formats: [{
				'backendFormat' : 'YYYY-MM-DD',
				'frontendFormat' : 'DD.MM.YYYY',
			}]
		});
	</script>

Convert dates with customizable formats
---------------------------------------
Assuming that the variable "birthday" has the (backend) format "YYYY-mm-dd" in UTC. Only the year should be show to the user:

	<span th:text="${{birthday}}" class="dateformat-custom" date-format="YYYY"></span>
	
	<script type="text/javascript">
		// UTC is implicitly activated
		sprat.ui.datetime.init({ 
			// backendFormat and frontendFormat are just defaults
			formats: [{
				'cssSuffix': '-custom
				'backendFormat' : 'YYYY-MM-DD',
				'frontendFormat' : 'DD.MM.YYYY',
			}]
		});
	</script>
	
User can select an input date
-----------------------------
User can choose the birthday. Backend populates "birthday" with format "YYYY-mm-dd" in UTC.

	<div class="input-group">
		<!-- the hidden fields stores the *real* date which will be examined by the backend -->
		<input type="hidden" th:field="*{{birthday}}" />
		<!-- datepicker. Every date chosen by the user will be converted to UTC and stored in the backing-field input[name='birthday'] -->
		<input type="text" th:value="*{{birthday}}" backing-field="birthday" class="form-control datepicker" /> 
		<span class="input-group-addon"> 
			<span class="glyphicon glyphicon-calendar"></span>
		</span>
	</div>
	
	<script type="text/javascript">
		// UTC is implicitly activated
		sprat.ui.datetime.init({ 
			formats: [{
				'backendFormat' : 'YYYY-MM-DD',
				'frontendFormat' : 'DD.MM.YYYY',
			}]
		});
	</script>

User can select date and time
-----------------------------
User can select any date and time. Backend populates "availableSince" with format "YYYY-mm-dd HH:ii" in UTC.
	<div class="input-group">
		<!-- hidden field for storing the *real* date/time -->
		<input type="hidden" th:field="*{{availableSince}}" />
		<!-- store UTC date/time in backing-field "availableSince" -->
		<input type="text" th:value="*{{availableSince}}" backing-field="availableSince" class="form-control datepicker-with-time" /> 
		<span class="input-group-addon"> 
			<span class="glyphicon glyphicon-calendar"></span>
		</span>
	</div>

	<script type="text/javascript">
		// UTC is implicitly activated
		sprat.ui.datetime.init({ 
			formats: [{
				'cssSuffix':	'-with-time
				'backendFormat' : 'YYYY-MM-DD HH:mm',
				'frontendFormat' : 'DD.MM.YYYY HH:mm'
			}]
		});
	</script>
	
The input fields show the backend date "2015-04-08 11:37" (UTC) as "08.04.2015 12:37" (GMT+1). The summer time is currently ignored.
After chosing a new date/time, the input datetimepicker updates the hidden field with UTC-ified time. 