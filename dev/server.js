'use strict';

const	ClientConnection	= require( './clientconnection' ),
		CouchConnection		= require( './couch.js' ),
		MailService			= require( './mailservice.js' ),
		DDoSControl			= require( './ddoscontrol.js' ),
		Crypto				= require( './crypto.js' ),
		Static				= require( './static.js' ),
		PayPal				= require( './paypal.js' ),
		stripHTML			= require( 'sanitize-html' ),
		path				= require( 'path' );

const	{ Seconds, Minutes, Hours, timeout, extend, Composition, readFile, writeFile, mkdirSync, log } = require( './toolkit.js' );


const	DEVMODE	= process.argv[ 2 ] === 'dev';


class Server extends Composition( CouchConnection, MailService, ClientConnection, DDoSControl, PayPal, Crypto, Static ) {
	constructor( input = { } ) {
		super( ...arguments );

		extend( this ).with( input ).and({
			DEVMODE:				DEVMODE,
			name:					'Die vegane Mangelernährung',
			uri:					DEVMODE ? 'https://dev.veganemangelernährung.de' : 'https://www.veganemangelernährung.de',
			baseRootPath:			DEVMODE ? '/var/www/html/dev.veganemangelernaehrung.de' : '/var/www/html/veganemangelernaehrung.de',
			imageRootPath:			DEVMODE ? '/var/www/html/dev.veganemangelernaehrung.de/images' : '/var/www/html/veganemangelernaehrung.de/images',
			staticRootPath:			DEVMODE ? '/var/www/html/dev.veganemangelernaehrung.de/static' : '/var/www/html/veganemangelernaehrung.de/static'
		});

		//this.ignoredPackets.set( '???', true );

		return this.init();
	}

	async init() {
		super.init && await super.init( ...arguments );

		log( `\nServer ${ this.name } is listening on port ${ this.port }.`, 'green' );
		log( `Server is ready and waiting for incoming connections...\n---------------\n`, 'green' );

		this.socket.on( 'connection', this.newConnection.bind( this ) );

		process.on( 'SIGINT', this.onProcessExit.bind( this ) );
		process.on( 'uncaughtException', this.onProcessExit.bind( this ) );
		process.on( 'SIGTERM', this.onProcessExit.bind( this ) );
	}

	newConnection( client ) {
		client.clientIPAddress		= client.request.headers[ 'x-forwarded-for' ] || client.conn.transport.socket._socket.remoteAddress;

		log( `New Client Connection from: ${ client.clientIPAddress }`, 'yellow' );

		client.on( 'disconnect', this.closeConnection.bind( this, client ) );

		super.newConnection && super.newConnection( ...arguments );
	}

	async closeConnection( client, reason ) {
		log( `Closed connection from: ${ client.clientIPAddress } (${ client.id }), reason: ${ reason }`, 'red' );

		client = null;

		super.closeConnection && super.closeConnection( ...arguments );
	}

	async adminNotification( subject = `admin notification [${ this.uri }]`, content = '' ) {
		let mailStatus = await this.sendMail({
			toList:		'admin@veganemangelernaehrung.de',
			subject:	subject,
			text:		stripHTML( content, { allowedTags: [ ] } ),
			html:		content.replace( /\n/g, '<br/>' )
		});

		console.log( 'Admin Notification: ', subject, content );
	}

	//////////////////////////////////////////////////

	async onProcessExit() {
		this.DEVMODE && log( 'Processing & storing in-memory data while exiting server process...', 'yellow' );

		this.DEVMODE && log( 'done.', 'green' );
		process.exit();
	}

	async onExample( client, payload, answer ) {
		try {
			answer(this.message({
				msg: 'onExample Message return'
			}));

			this.socket.emit( 'exampleBroadcastToAllClients', {
				user:	user.nickName,
				email:	user.email
			});
		} catch( ex ) {
			console.log( 'onExample:', ex );

			answer(this.message({
				error:	'Es ist ein unbekannter Fehler aufgetreten.',
				code:	0xa2
			}));
		}
	}

	message( info ) {
		return Object.assign({
			data:		{ },
			msg:		'',
			error:		'',
			errorCode:	0,
			warning:	''
		}, info );
	}
}

if( DEVMODE ) {
	log( 'DEV MODE SERVER', 'yellow' );
	new Server({ name: 'VEGANEMANGELERNÄHRUNG (DEV)', port: 2252 });
} else {
	log( 'PROD MODE SERVER, WE ARE LIVE BOYS', 'red' );
	new Server({ name: 'VEGANEMANGELERNÄHRUNG', port: 2250 });
}
