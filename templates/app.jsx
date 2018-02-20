var qs    = require('qs');
var React = require('react/addons');
var cx    = require('classnames');

var Checkbox        = require('../components/field-checkbox.jsx');
var ErrorsDisplay   = require('../components/errors-display.jsx');
var Field           = require('../components/field-text.jsx');
var Options         = require('../components/field-options.jsx');
var PaginatorButton = require('../components/paginator-button.jsx');
var PaginatorLinks  = require('../components/paginator-links.jsx');
var PaginatorSteps  = require('../components/paginator-steps.jsx');
var Select          = require('../components/field-select.jsx');
var Step            = require('../components/step.jsx');

var tags         = require('../library/tags.js');
var smoothScroll = require('../library/scroll.js');
var states       = require('../data/states.json');

// Load these modules later (after config is loaded into window);
var blur, change, processors, validator, transformers;
var queries = qs.parse( location.search.substr(1) );

var Sequential = React.createClass({

    propTypes: {
        options: React.PropTypes.object.isRequired
    },

    getInitialState: function() {
        return {
            form: { focus: null, fields: {}, step: 1 },
            steps: [],
            error: '',
            status: 'render',
            amount: 0
        };
    },

    componentWillMount: function() {
        // Read all the config items into state
        var self = this;

        if ( this.props.options ) {
            // todo: rename our namespace
            global.rsd = { options: self.props.options || {} };
        }

        // Late load modules that depend on set globals
        processors = require('../library/processors.js');
        validator = require('../library/validators.js');
        transformers = require('../library/transformers.js');
        change = require('../library/handle-change.js');
        blur = require('../library/handle-blur.js');
    },

    componentDidMount: function() {
        // Now that the app is loaded, allow the user to interact with it.
        var state = this.state;
        state.status = "interactive";

        var nbDonationForm = document.getElementById('donate_page_new_donation_form');
        
        setTimeout(function() {
            nbDonationForm.parentNode.removeChild(nbDonationForm);
            console.log("yo");
        }.bind(this), 5000);

        state.authenticityToken = nbDonationForm.querySelectorAll('[name="authenticity_token"]')[0].value;

        // If debug-thanks=true is set, go directly to our Thank You page
        if ( queries["debug-thanks"] === "true" ) {
            state.form.step = ( this.state.steps.length );
        }

        this.setState( state );

        // shouldComponentUpdate runs on a different timetable then us - a little
        // behind the flow of things, so forceUpdate to make the button render.
        this.forceUpdate();
    },

    shouldComponentUpdate: function() {
        // This prevents our app from redrawing 8 times while figuring out fields
        // and steps and theoritically speeds it up a tiny bit
        if ( this.state.status === "render" ) {
            return false;
        } else {
            return true;
        }
    },

    getDefaultProps: function() {
        // TODO: Defaults, option validation,

        // Sadly these don't actually merge in with our existing props like they would
        // with jQuery so there's no use to make this comprehensive (yet);
        return {
            options: {
                slug: "",
                debug: false,
                apikey: "",
                formid: "",
                amounts: { 10: 10, 25: 25, 50: 50, 100: 100 },
                processor: "stripe"
            }
        };
    },

    componentDidUpdate: function (prevProps, prevState) {
        if ( prevState.form.step === 1 && this.state.form.step === 2 ) {
            var target = document.getElementById('patronage-donate-form');
            smoothScroll(document.body, target.getBoundingClientRect().top, 300);
        }
    },

    switchStep: function( next ) {
        next = parseInt( next );
        var state = this.state;

        // Only switch step if the app is in interactive mode
        if ( this.state.status === "interactive" || this.state.status === "submitting" ) {
            // Check range validity
            if ( next <= this.state.steps.length ) {
                // Run the validator real quick, just in case data was autofilled
                var results = validator.run( this.state.form.step, this.state, this.refs );
                this.setState({ form: results.form });

                var switchable = true;

                // Check all prior steps for validity before switching
                for ( var i = 0; i < ( next - 1 ); i++ ) {
                    var step = this.state.steps[i];

                    if ( !step.valid ) {
                        switchable = false;
                    }
                }

                // Only switch if all prior steps are valid
                if ( switchable ) {
                    if ( typeof global.rsd.options.onSwitchStep === "function" ) {
                        global.rsd.options.onSwitchStep( next );
                    }

                    state.form.step = next;

                    this.setState( state );
                }
            }
        }
    },

    setParentState: function( newState ) {
        // This allows children to edit the parent state easily, which is primarily
        // used for automating some things with fields and steps
        this.setState( newState );
    },

    handleChange: function( event ) {
        if ( this.state.status === "interactive" ) {
            // Charge() is a function that works with <Field /> to handle all
            // field data given <Field />s attributes
            var parsed = change( event, this.state, this.refs );

            if ( parsed ) {
                var data = {
                    form: parsed.form,
                    steps: parsed.steps
                };

                if ( parsed.amount ) {
                    data.amount = parsed.amount;
                }

                this.setState( data );
            }

            if ( event.target.type === "radio" ) {
                // Chrome won't fire onBlur for radio buttons so we'll do that
                // ourselves because react
                this.handleBlur( event );
            }
        }
    },

    handleBlur: function( event ) {
        if ( this.state.status === "interactive" ) {
            // Blur() is a function that works with <Field /> to handle all
            // field data given <Field />s attributes
            var parsed = blur( event, this.state, this.refs );

            if ( parsed ) {
                this.setState({
                    form: parsed.form,
                    steps: parsed.steps
                });
            }
        }
    },

    handleSubmit: function( event ) {
        
    },

    getValue: function( field ) {
        if ( typeof this.state.form.fields[ this.props.name ] !== "undefined" ) {
            return this.state.form.fields[ this.props.name ].value;
        } else {
            return "";
        }
    },

    render: function() {
        var fields = processors[ global.rsd.options.processor ].fields;

        var classes = cx({
            "patronage-donate": true,
            "is-complete": this.state.status === "complete",
            "is-sequential": typeof global.rsd.options.sequential !== "undefined" ? global.rsd.options.sequential : true,
            "is-not-sequential": typeof global.rsd.options.sequential !== "undefined" ? !global.rsd.options.sequential :  false
        });

        return (
            <div className={ classes }>
                <form novalidate="" id="donate_page_new_donation_form" class="staged-donation" method="POST" autocomplete="on" action="/forms/donations">
                    <input name="authenticity_token" type="hidden" value={ this.state.authenticityToken } />
                    <input name="page_id" type="hidden" value="3731" />
                    <input name="return_to" type="hidden" value="https://uniteamerica-centristproject.nationbuilder.com/donate" />
                    <input name="email_address" type="text" class="text" id="email_address" autocomplete="off" />
                    <input type="hidden" name="donation[is_confirmed]" value="1" />
                    <input class="checkbox__input" id="is_volunteer" name="is_volunteer" type="checkbox" value="1" /> 
                    <input class="button" type="submit" name="commit" value="Process Donation" />
                </form>

            </div>
        );
    }
});

module.exports = Sequential;

global.PatronageDonate = function( element, options ) {
    React.render(
        <Sequential options={ options } />,
        element
    );
};
