'use strict';

const	paypal	= require( 'paypal-rest-sdk' ),
		fs		= require( 'fs' ),
		path	= require( 'path' );

const	{ extend, log }	= require( './toolkit.js' );

let PayPal = target => class extends target {
	constructor( input = { } ) {
		super( ...arguments );

		extend( this ).with({
			payments:				paypal.v1.payments
		}).and( input );
	}

	async init() {
		super.init && await super.init( ...arguments );

		let idsJSONstring, paypalEnvironment;

		try {
			idsJSONstring = fs.readFileSync( path.resolve( `${ __dirname }/../paypal/ids.json` ), 'utf-8' );
		} catch( ex ) {
			throw new Error( `Error while reading ../paypal/ids.json: ${ ex.message }` );
		}

		try {
			let ppids	= JSON.parse( idsJSONstring );

			if( this.DEVMODE ) {
				paypalEnvironment = new paypal.core.SandboxEnvironment( ppids.sandbox.client, ppids.sandbox.secret );
			} else {
				paypalEnvironment = new paypal.core.LiveEnvironment( ppids.live.client, ppids.live.secret );
			}

			this.ppClient = new paypal.core.PayPalHttpClient( paypalEnvironment );
		} catch( ex ) {
			throw new Error( `Error while setting up PayPal Environment: ${ ex.message }` );
		}
	}

	async createPayment({ currency = 'EUR', method = "paypal", note = "", amount, cancelURL, returnURL }) {
		let payment = {
			"intent":		"sale",
			"transactions":	[{
				"item_list":	{
					items:	[{
						"name":			"Apfel",
						"description":	"Ein brandneuer Apfel... vom Baum!",
						"quantity":		1,
						"price":		amount,
						"tax":			0.01,
						"currency":		currency
					}]
				},
				"amount":		{
					"currency":	currency,
					"total":	amount
				},
				"description":	""
			}],
			"redirect_urls":	{
				"cancel_url":	cancelURL,
				"return_url":	returnURL
			},
			"payer":	{
				"payment_method":	method
			}
		};

		let req = new this.payments.PaymentCreateRequest();
		req.requestBody( payment );

		try {
			let res = await this.ppClient.execute( req );

			return res.result.links.find( items => items.rel === 'approval_url' ).href;
		} catch( ex ) {
			log( `PayPal createPayment Fehler: ${ ex.message }`, 'red' );
			return -1;
		}
	}

	async executePayment({ paymentId = '', PayerID = '', currency = 'EUR', total = 52 }) {
		let execute_payment = {
			"payer_id":			PayerID,
			"transactions":		[{
				"amount":	{
					"currency":	currency,
					"total":	total
				}
			}]
		};

		let req = new this.payments.PaymentExecuteRequest( paymentId );
		req.requestBody( execute_payment );

		try {
			let res = await this.ppClient.execute( req );

			console.log( 'executePayment Result: ', res );

			return true;
		} catch( ex ) {
			log( `PayPal executePayment Fehler: ${ ex.message }`, 'red' );
			return -1;
		}
	}

	newConnection( client ) {
		super.newConnection && super.newConnection( ...arguments );

		client.on( 'buy', this.buy.bind( this, client ) );
		client.on( 'ppexecute', this.executeBuy.bind( this, client ) );
	}

	async buy( client, payload, answer ) {
		let ppUrl = await this.createPayment({
			method:		'paypal',
			amount:		52,
			cancelURL:	`https://${ this.DEVMODE ? 'dev' : 'www' }.veganemangelernährung.de/`,
			returnURL:	`https://${ this.DEVMODE ? 'dev' : 'www' }.veganemangelernährung.de/`
		});

		answer(this.message({
			data: {
				ppUrl:	ppUrl
			}
		}));
	}

	async executeBuy( client, payload, answer ) {
		await this.executePayment( payload );
	}
};

module.exports = exports = PayPal;
